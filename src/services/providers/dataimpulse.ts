import { randomBytes, randomInt } from "crypto";
import { request as httpsRequest } from "https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";
import type {
  ProviderAdapter,
  CreateProxyCredentialParams,
  UpstreamProvisionResult,
  ProxyUsageQuery,
  ProxyUsageResult,
  GatewayHealthResult,
  LocationOption,
  ProductOption,
  UpstreamConnectionInfo,
} from "./types";

const PROVIDER_SLUG = "dataimpulse";

// Confirmed against docs.dataimpulse.com (Sep 2026): proxies/connection-hosts.md,
// port-access.md, proxies/types-of-connections.md, proxies/parameters*.md.
// Re-check those pages before touching this — their docs had at least one
// internal inconsistency already (an example showed port 10000 in a
// country-targeting snippet that had nothing to do with sticky sessions),
// so don't trust a single example in isolation.
const PROXY_HOST = "gw.dataimpulse.com";
const ROTATING_HTTP_PORT = 823;
// Sticky sessions are PORT-BASED, not encoded purely in username/password
// like every other adapter in this codebase: "IP addresses are bound to a
// specific port for a period of time" (types-of-connections.md). Any port
// in this range pins to one exit IP for the session's rotation interval.
// NOT CONFIRMED by DataImpulse's public docs: whether this range (and
// therefore a given port number) is scoped per-account or shared globally
// across resellers/sub-users. Since this adapter uses ONE shared sub-user
// login for every customer (not a distinct sub-user per customer via the
// reseller API — that's a possible future improvement, not done yet), two
// DIFFERENT customers could otherwise be assigned the same sticky port and
// silently share an exit IP if ports turn out to be account-scoped in a
// way we're not modeling. Defended against below by ALWAYS pairing a
// sticky port with a unique sessid — sessid is documented as "any string
// or number" for pinning a session, so even if port-sharing behaves
// unexpectedly, the sessid remains a second, explicit disambiguator.
const STICKY_PORT_MIN = 10_000;
const STICKY_PORT_MAX = 20_000;
const DEFAULT_STICKY_TTL_MINS = 30; // matches the account-wide default documented in session-id.md

// Labels the admin must type exactly (case-sensitive) into "Additional
// credentials" on /admin/providers for the dataimpulse Provider row.
// apiLogin/apiPassword are stored for when the reseller control API's auth
// is resolved (see below) but NOT used by anything in this file yet.
//
// UNRESOLVED as of this writing: the reseller control-API's actual Bearer
// auth flow (base https://api.dataimpulse.com/reseller — add a
// CONTROL_API_BASE constant back here once this is sorted). The
// dashboard's "API Management" page shows an "API Login" (email) + "API
// Password" (a plain ~32-char string) pair, but sending that password
// directly as `Authorization: Bearer <password>` fails with "Wrong number
// of segments" — the server appears to expect an actual JWT, implying an
// undocumented login/exchange step this codebase does not perform yet.
// getGatewayHealth/getProxyUsage below are written defensively (fail to
// OFFLINE / zero) rather than assume a specific auth scheme that hasn't
// been verified working. The PROXY itself (login/password below) is
// unaffected by this — that's separate, confirmed, and already working
// via user:pass auth at the gateway host above.
const CRED = {
  apiLogin: "API Login",
  apiPassword: "API Password",
  proxyUsername: "Proxy Username", // one sub-user's "login" field from the dashboard
  proxyPassword: "Proxy Password", // that same sub-user's "password" field
} as const;

/**
 * DataImpulse residential proxies. Uses ONE shared sub-user's login/
 * password for every customer credential this app issues (same
 * single-account pattern as iproyal.ts) — not the reseller API's
 * per-customer sub-user creation, which would need the unresolved auth
 * flow above to work first. Targeting goes in the USERNAME (unlike
 * IPRoyal, which uses the password): `login__key.value;key.value`.
 * Stickiness is primarily PORT-based (see STICKY_PORT_MIN/MAX above), with
 * sessid layered on as a second disambiguator.
 */
export class DataImpulseProviderAdapter implements ProviderAdapter {
  readonly providerSlug = PROVIDER_SLUG;

  private async getProvider() {
    const provider = await prisma.provider.findUnique({ where: { slug: PROVIDER_SLUG } });
    if (!provider) {
      throw new Error(
        `No Provider row for slug "${PROVIDER_SLUG}" — create one at /admin/providers first.`,
      );
    }
    return provider;
  }

  private async getCredential(providerId: string, label: string): Promise<string> {
    const cred = await prisma.providerCredential.findFirst({
      where: { providerId, label, active: true },
    });
    if (!cred) {
      throw new Error(
        `Missing "${label}" credential for DataImpulse — add it under Additional credentials at /admin/providers.`,
      );
    }
    return decryptSecret(cred.encryptedValue);
  }

  // Memoized per adapter instance — see the identical comment in
  // bright-data.ts's getZoneConfig(); same reasoning applies here.
  private accountConfigPromise: ReturnType<typeof this.fetchAccountConfig> | null = null;

  private getAccountConfig() {
    if (!this.accountConfigPromise) {
      this.accountConfigPromise = this.fetchAccountConfig();
    }
    return this.accountConfigPromise;
  }

  private async fetchAccountConfig() {
    const provider = await this.getProvider();
    const [username, password] = await Promise.all([
      this.getCredential(provider.id, CRED.proxyUsername),
      this.getCredential(provider.id, CRED.proxyPassword),
    ]);
    return { provider, username, password };
  }

  private buildTargetedUsername(
    baseUsername: string,
    params: { country?: string; city?: string; sessionId?: string; sessionTtlMins?: number },
  ): string {
    const segments: string[] = [];
    if (params.country) segments.push(`cr.${params.country.toLowerCase()}`);
    if (params.city) segments.push(`city.${params.city.toLowerCase().replace(/\s+/g, "")}`);
    if (params.sessionId) segments.push(`sessid.${params.sessionId}`);
    if (params.sessionTtlMins) segments.push(`sessttl.${params.sessionTtlMins}`);
    if (segments.length === 0) return baseUsername;
    return `${baseUsername}__${segments.join(";")}`;
  }

  async createProxyCredential(
    params: CreateProxyCredentialParams,
  ): Promise<UpstreamProvisionResult> {
    const { username, password } = await this.getAccountConfig();

    const isSticky = params.sessionType === "STICKY";
    // Rotating: fixed port 823, no sessid — a fresh exit IP per request,
    // confirmed by docs as the rotating-HTTP port's behavior.
    // Sticky: a port drawn from the account's sticky range PLUS an
    // explicit random sessid (see the STICKY_PORT_MIN/MAX comment above
    // for why both, not just the port).
    const port = isSticky ? randomInt(STICKY_PORT_MIN, STICKY_PORT_MAX + 1) : ROTATING_HTTP_PORT;
    const sessionId = isSticky ? randomBytes(6).toString("hex") : undefined;

    const targetedUsername = this.buildTargetedUsername(username, {
      country: params.country,
      city: params.city,
      sessionId,
      sessionTtlMins: isSticky ? (params.sessionDurationMins ?? DEFAULT_STICKY_TTL_MINS) : undefined,
    });

    return {
      upstreamSessionRef: JSON.stringify({
        username: targetedUsername,
        password,
        port,
        sessionType: params.sessionType,
      }),
      exitCountry: params.country,
      // Not known synchronously — assigned per-connection from the pool,
      // same as every other adapter in this codebase.
      exitIp: undefined,
    };
  }

  async disableProxyCredential(_upstreamSessionRef: string): Promise<void> {
    // No revoke call — nothing persistent upstream to tear down for a
    // shared-sub-user credential; a sticky session simply expires after
    // its sessttl. Revisit if/when this moves to per-customer sub-users
    // via the reseller API, which DOES have real objects to disable.
    return;
  }

  async updateProxyCredential(
    upstreamSessionRef: string,
    params: Partial<CreateProxyCredentialParams>,
  ): Promise<UpstreamProvisionResult> {
    const { username: baseUsername, password } = await this.getAccountConfig();
    const prev = JSON.parse(upstreamSessionRef) as {
      username: string;
      password: string;
      port: number;
      sessionType?: string;
    };
    const prevSessionMatch = prev.username.match(/sessid\.([A-Za-z0-9]+)/);
    const isSticky = prev.sessionType === "STICKY";

    const targetedUsername = this.buildTargetedUsername(baseUsername, {
      country: params.country,
      city: params.city,
      sessionId: prevSessionMatch?.[1],
      sessionTtlMins: isSticky ? params.sessionDurationMins : undefined,
    });

    return {
      upstreamSessionRef: JSON.stringify({
        username: targetedUsername,
        password,
        port: prev.port,
        sessionType: prev.sessionType,
      }),
      exitCountry: params.country,
      exitIp: undefined,
    };
  }

  /**
   * UNVERIFIED — see the CRED block's comment: the reseller control API's
   * Bearer auth flow isn't confirmed working from this codebase yet.
   * Returns zeros honestly (same stance as iproyal.ts/rayobyte.ts) rather
   * than guess at a usage-by-date-range endpoint shape that hasn't been
   * confirmed either. Real usage tracking comes from the gateway's own
   * byte counting until this is resolved.
   */
  async getProxyUsage(_query: ProxyUsageQuery): Promise<ProxyUsageResult> {
    return { bytesUploaded: 0, bytesDownloaded: 0, requestCount: 0 };
  }

  async getGatewayHealth(): Promise<GatewayHealthResult> {
    const { username, password } = await this.getAccountConfig();

    const start = Date.now();
    try {
      // No DataImpulse-specific test endpoint confirmed — same generic
      // IP-echo approach as iproyal.ts/rayobyte.ts: any 2xx through the
      // proxy proves the credential and route both work. Uses the
      // rotating port (823) for the health check, not a sticky one, so
      // this never consumes/collides with a sticky port slot.
      await proxyTestRequest(username, password, ROTATING_HTTP_PORT);
      return { status: "HEALTHY", latencyMs: Date.now() - start, successRatePercent: 100 };
    } catch {
      return { status: "OFFLINE", latencyMs: Date.now() - start, successRatePercent: 0 };
    }
  }

  async getAvailableLocations(_productSlug: string): Promise<LocationOption[]> {
    // DataImpulse's reseller API DOES have a real
    // common/locations/countries endpoint (confirmed in their Postman
    // docs) that would give the true supported list — not wired up here
    // because it needs the same unresolved Bearer-auth flow as
    // getProxyUsage/getGatewayHealth above. Curated set in the meantime,
    // same approach as every other adapter in this codebase.
    return [
      { country: "US" }, { country: "GB" }, { country: "CA" }, { country: "DE" },
      { country: "FR" }, { country: "AU" }, { country: "JP" }, { country: "BR" },
      { country: "IN" }, { country: "MX" }, { country: "ES" }, { country: "IT" },
      { country: "NL" }, { country: "SE" }, { country: "SG" },
    ];
  }

  async getAvailableProducts(): Promise<ProductOption[]> {
    return [{ slug: "residential" }];
  }

  async getUpstreamConnection(upstreamSessionRef: string): Promise<UpstreamConnectionInfo> {
    // The full targeted username, password, AND port were all stored
    // directly in the ref at creation time — no need to re-derive any of
    // it from stored credentials here, same as IPRoyal/Rayobyte's
    // password-based approach, just with port added since DataImpulse's
    // stickiness depends on it too.
    const { username, password, port } = JSON.parse(upstreamSessionRef) as {
      username: string;
      password: string;
      port: number;
    };
    return { host: PROXY_HOST, port, username, password };
  }
}

function proxyTestRequest(username: string, password: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const agent = new HttpsProxyAgent(
      `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${PROXY_HOST}:${port}`,
    );
    const req = httpsRequest(
      "https://api.ipify.org",
      { agent, timeout: 10_000 },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          if (res.statusCode && res.statusCode < 400) resolve();
          else reject(new Error(`Proxy test request returned ${res.statusCode}`));
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Proxy test request timed out")));
    req.on("error", reject);
    req.end();
  });
}
