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
} from "./types";

const PROVIDER_SLUG = "iproyal";

// Verified against docs.iproyal.com (Aug 2026) — IPRoyal residential proxy
// access point and password-suffix targeting/session syntax. Re-check
// before touching these; their legacy API was deprecated Sep 2025, so
// they do change this surface.
const PROXY_HOST = "geo.iproyal.com"; // auto-routes by the password's country- suffix
const PROXY_PORT = 12321;
const CONTROL_API_BASE = "https://resi-api.iproyal.com/v1";

// Labels the admin must type exactly (case-sensitive) into "Additional
// credentials" on /admin/providers for the iproyal Provider row.
// "Primary API key" reuses the built-in single-secret field for the Bearer
// control-API token.
const CRED = {
  apiKey: "Primary API key",
  proxyUsername: "Proxy Username",
  proxyPassword: "Proxy Password",
} as const;

/**
 * IPRoyal residential proxies. Like Bright Data, targeting and stickiness
 * are encoded client-side into the proxy credential string — but IPRoyal
 * puts it in the PASSWORD (`basePassword_country-us_session-xxx_lifetime-30m`)
 * rather than the username, and there's a single shared username/password
 * for the account rather than a per-zone credential. No provisioning API
 * call is needed to "create" a session.
 */
export class IPRoyalProviderAdapter implements ProviderAdapter {
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
        `Missing "${label}" credential for IPRoyal — add it under Additional credentials at /admin/providers.`,
      );
    }
    return decryptSecret(cred.encryptedValue);
  }

  private async getAccountConfig() {
    const provider = await this.getProvider();
    const [username, basePassword] = await Promise.all([
      this.getCredential(provider.id, CRED.proxyUsername),
      this.getCredential(provider.id, CRED.proxyPassword),
    ]);
    return { provider, username, basePassword };
  }

  private buildPassword(
    basePassword: string,
    params: { country?: string; city?: string; sessionId?: string; lifetimeMins?: number },
  ): string {
    const parts = [basePassword];
    if (params.country) parts.push(`country-${params.country.toLowerCase()}`);
    if (params.city) parts.push(`city-${params.city.toLowerCase().replace(/\s+/g, "")}`);
    if (params.sessionId) parts.push(`session-${params.sessionId}`);
    if (params.lifetimeMins) parts.push(`lifetime-${params.lifetimeMins}m`);
    return parts.join("_");
  }

  async createProxyCredential(
    params: CreateProxyCredentialParams,
  ): Promise<UpstreamProvisionResult> {
    const { username, basePassword } = await this.getAccountConfig();

    const sessionId =
      params.sessionType === "STICKY" ? randomBytes(6).toString("hex") : undefined;

    const password = this.buildPassword(basePassword, {
      country: params.country,
      city: params.city,
      sessionId,
      lifetimeMins: params.sessionType === "STICKY" ? (params.sessionDurationMins ?? 30) : undefined,
    });

    return {
      upstreamSessionRef: JSON.stringify({ username, password, sessionType: params.sessionType }),
      exitCountry: params.country,
      // Not known synchronously — IPRoyal assigns the exit IP per-request
      // from the pool, same as Bright Data.
      exitIp: undefined,
    };
  }

  async disableProxyCredential(_upstreamSessionRef: string): Promise<void> {
    // No revoke call — nothing persistent upstream to tear down.
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
    const prevSessionMatch = prev.password.match(/_session-([a-z0-9]+)/);

    const password = this.buildPassword(basePassword, {
      country: params.country,
      city: params.city,
      sessionId: prevSessionMatch?.[1],
      lifetimeMins: params.sessionDurationMins,
    });

    return {
      upstreamSessionRef: JSON.stringify({ username: prev.username, password, sessionType: prev.sessionType }),
      exitCountry: params.country,
      exitIp: undefined,
    };
  }

  /**
   * IPRoyal's only account-level endpoint (GET /me) reports *remaining*
   * prepaid balance, not usage over a period or per-order/session — there's
   * no equivalent of Bright Data's per-zone bandwidth-by-date-range
   * endpoint. Returning zeros here is honest, not a bug: real per-customer
   * usage tracking for this provider has to come from the gateway's own
   * byte counting when it forwards traffic, not from IPRoyal's API.
   */
  async getProxyUsage(_query: ProxyUsageQuery): Promise<ProxyUsageResult> {
    return { bytesUploaded: 0, bytesDownloaded: 0, requestCount: 0 };
  }

  async getGatewayHealth(): Promise<GatewayHealthResult> {
    const provider = await this.getProvider();
    const apiKey = await this.getCredential(provider.id, CRED.apiKey);
    const { username, basePassword } = await this.getAccountConfig();

    const start = Date.now();
    try {
      const res = await fetch(`${CONTROL_API_BASE}/me`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`IPRoyal API returned ${res.status}`);

      // API key being valid doesn't mean the proxy credential actually
      // works — confirm with a real request through the proxy itself.
      await proxyTestRequest(username, basePassword);

      return { status: "HEALTHY", latencyMs: Date.now() - start, successRatePercent: 100 };
    } catch {
      return { status: "OFFLINE", latencyMs: Date.now() - start, successRatePercent: 0 };
    }
  }

  async getAvailableLocations(_productSlug: string): Promise<LocationOption[]> {
    // No confirmed country-list endpoint in current docs — curated set of
    // countries we actually want to sell, same approach as Bright Data.
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
}

/**
 * No IPRoyal-specific test endpoint confirmed in their docs (unlike Bright
 * Data's brdtest.com), so this checks connectivity through a generic public
 * IP-echo service — any 2xx response through the proxy proves the
 * credential and route both work.
 */
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
