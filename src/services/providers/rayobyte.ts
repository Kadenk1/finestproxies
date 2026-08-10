import { randomBytes } from "crypto";
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

const PROVIDER_SLUG = "rayobyte";

// Confirmed from ONE live sample credential (Aug 2026):
//   la.residential.rayobyte.com:9000:nick_finestproxies_com-wu:eagw13ey-country-US-hardsession-AjhfEsbm-duration-60
// Host/port and the password's field format (country-XX, hardsession-XXXX,
// duration-N) are taken directly from that string. NOT yet confirmed against
// docs.rayobyte.com or a second sample:
//   - Whether "la" in the hostname is a fixed account/pool label (used as-is
//     below) or actually varies by target region/country — if it turns out
//     regional routing needs a different subdomain per country, buildPassword's
//     country- field alone won't be enough and this needs revisiting.
//   - Whether hardsession- accepts a caller-supplied ID (assumed yes, same as
//     the sample's "AjhfEsbm") or must be requested from an API first.
//   - Exact city-targeting field name/format, if any.
//   - The usage/bandwidth API shape — no base URL confirmed yet, so
//     getProxyUsage below returns zeros rather than guess at an endpoint
//     (same honest-not-a-bug stance as iproyal.ts). Add a CONTROL_API_BASE
//     constant here once the real endpoint is confirmed, same pattern as
//     bright-data.ts/iproyal.ts.
// Re-verify all of the above against real docs/dashboard before relying on
// this in production the way bright-data.ts/iproyal.ts's adapters are.
const PROXY_HOST = "la.residential.rayobyte.com";
const PROXY_PORT = 9000;

// Labels the admin must type exactly (case-sensitive) into "Additional
// credentials" on /admin/providers for the rayobyte Provider row. "Primary
// API key" reuses the built-in single-secret field for the Bearer
// control-API token.
const CRED = {
  apiKey: "Primary API key",
  proxyUsername: "Proxy Username",
  proxyPassword: "Proxy Password", // the base secret only, e.g. "eagw13ey" — NOT the full targeted string
} as const;

/**
 * Rayobyte residential proxies. Like IPRoyal, targeting is encoded
 * client-side into the PASSWORD (`basePassword-country-US-hardsession-XXXX-duration-N`)
 * against one shared account username/password — no provisioning API call
 * needed to "create" a session, and there's no per-zone credential the way
 * Bright Data has.
 */
export class RayobyteProviderAdapter implements ProviderAdapter {
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
        `Missing "${label}" credential for Rayobyte — add it under Additional credentials at /admin/providers.`,
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
    const [username, basePassword] = await Promise.all([
      this.getCredential(provider.id, CRED.proxyUsername),
      this.getCredential(provider.id, CRED.proxyPassword),
    ]);
    return { provider, username, basePassword };
  }

  private buildPassword(
    basePassword: string,
    params: { country?: string; sessionId?: string; durationMins?: number },
  ): string {
    const parts = [basePassword];
    if (params.country) parts.push(`country-${params.country.toUpperCase()}`);
    if (params.sessionId) parts.push(`hardsession-${params.sessionId}`);
    if (params.durationMins) parts.push(`duration-${params.durationMins}`);
    return parts.join("-");
  }

  async createProxyCredential(
    params: CreateProxyCredentialParams,
  ): Promise<UpstreamProvisionResult> {
    const { username, basePassword } = await this.getAccountConfig();

    // A session id is always included, not just for STICKY — same defensive
    // reasoning as iproyal.ts: without a confirmed test showing that
    // omitting hardsession- actually rotates per-request, assuming that
    // behavior risks the exact bug already hit once on this project (every
    // "rotating" credential silently resolving to the same exit IP). A
    // rotating credential here gets its own fresh random session id with no
    // duration, so it's pinned to one IP for its own lifetime as a distinct
    // credential — not rotating per-request within a single credential.
    // Revisit once Rayobyte's actual rotation behavior is confirmed.
    const sessionId = randomBytes(4).toString("hex");

    const password = this.buildPassword(basePassword, {
      country: params.country,
      sessionId,
      durationMins: params.sessionType === "STICKY" ? (params.sessionDurationMins ?? 30) : undefined,
    });

    return {
      upstreamSessionRef: JSON.stringify({ username, password, sessionType: params.sessionType }),
      exitCountry: params.country,
      // Not known synchronously — assigned per-connection from the pool,
      // same as Bright Data/IPRoyal.
      exitIp: undefined,
    };
  }

  async disableProxyCredential(_upstreamSessionRef: string): Promise<void> {
    // No revoke call confirmed — nothing persistent upstream to tear down,
    // same as IPRoyal. Revisit if Rayobyte turns out to track sessions
    // server-side.
    return;
  }

  async updateProxyCredential(
    upstreamSessionRef: string,
    params: Partial<CreateProxyCredentialParams>,
  ): Promise<UpstreamProvisionResult> {
    const { basePassword } = await this.getAccountConfig();
    const prev = JSON.parse(upstreamSessionRef) as {
      username: string;
      password: string;
      sessionType?: string;
    };
    const prevSessionMatch = prev.password.match(/-hardsession-([A-Za-z0-9]+)/);

    const password = this.buildPassword(basePassword, {
      country: params.country,
      sessionId: prevSessionMatch?.[1],
      durationMins: params.sessionDurationMins,
    });

    return {
      upstreamSessionRef: JSON.stringify({ username: prev.username, password, sessionType: prev.sessionType }),
      exitCountry: params.country,
      exitIp: undefined,
    };
  }

  /**
   * UNVERIFIED — CONTROL_API_BASE and this endpoint shape are a guess
   * modeled on Bright Data's /zone/bw, not confirmed against Rayobyte's
   * actual API. Returns zeros (same honest-not-a-bug stance as
   * iproyal.ts's getProxyUsage) rather than pretend a real number, so real
   * usage tracking still comes from the gateway's own byte counting until
   * this is confirmed and wired up properly.
   */
  async getProxyUsage(_query: ProxyUsageQuery): Promise<ProxyUsageResult> {
    return { bytesUploaded: 0, bytesDownloaded: 0, requestCount: 0 };
  }

  async getGatewayHealth(): Promise<GatewayHealthResult> {
    const { username, basePassword } = await this.getAccountConfig();

    const start = Date.now();
    try {
      // No Rayobyte-specific test endpoint confirmed (unlike Bright Data's
      // brdtest.com) — same generic-IP-echo approach as iproyal.ts: any 2xx
      // through the proxy proves the credential and route both work,
      // independent of whatever CONTROL_API_BASE turns out to actually be.
      await proxyTestRequest(username, this.buildPassword(basePassword, {}));
      return { status: "HEALTHY", latencyMs: Date.now() - start, successRatePercent: 100 };
    } catch {
      return { status: "OFFLINE", latencyMs: Date.now() - start, successRatePercent: 0 };
    }
  }

  async getAvailableLocations(_productSlug: string): Promise<LocationOption[]> {
    // No confirmed country-list endpoint — curated set of countries we
    // actually want to sell, same approach as Bright Data/IPRoyal. US
    // confirmed working from the live sample; the rest are unverified
    // guesses at common residential coverage and should be trimmed/expanded
    // once Rayobyte's real supported-country list is confirmed.
    return [
      { country: "US" }, { country: "GB" }, { country: "CA" }, { country: "DE" },
      { country: "FR" }, { country: "AU" }, { country: "JP" }, { country: "BR" },
      { country: "IN" }, { country: "MX" },
    ];
  }

  async getAvailableProducts(): Promise<ProductOption[]> {
    return [{ slug: "residential" }];
  }

  async getUpstreamConnection(upstreamSessionRef: string): Promise<UpstreamConnectionInfo> {
    // The full password (with targeting suffixes already applied) was
    // stored directly in the ref at creation time — no need to re-derive it
    // from stored credentials here, same as IPRoyal.
    const { username, password } = JSON.parse(upstreamSessionRef) as {
      username: string;
      password: string;
    };
    return { host: PROXY_HOST, port: PROXY_PORT, username, password };
  }
}

function proxyTestRequest(username: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const agent = new HttpsProxyAgent(
      `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${PROXY_HOST}:${PROXY_PORT}`,
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
