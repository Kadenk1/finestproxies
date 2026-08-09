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

const PROVIDER_SLUG = "bright-data";

// Verified against docs.brightdata.com (Aug 2026) — Bright Data's proxy-zone
// access point and username-encoded targeting/session syntax. If they change
// this, every zone breaks at once, so re-check docs.brightdata.com/proxy-networks
// before touching these.
const PROXY_HOST = "brd.superproxy.io";
const PROXY_PORT = 44445;
const CONTROL_API_BASE = "https://api.brightdata.com";

// Labels the admin must type exactly (case-sensitive) into the "Additional
// credentials" rows on /admin/providers for the bright-data Provider row.
// "Primary API key" reuses the built-in single-secret field for the Bearer
// control-API token.
const CRED = {
  apiKey: "Primary API key",
  customerId: "Customer ID",
  zoneName: "Zone name",
  zonePassword: "Zone password",
} as const;

/**
 * Bright Data residential proxies. Unlike a provider with a real
 * provision/deprovision API, Bright Data residential sessions are entirely
 * client-side: the exit IP, country, and stickiness are all encoded into the
 * proxy username string, and the upstream has no notion of a "credential"
 * object to create or revoke. `upstreamSessionRef` here is just that
 * username string (JSON-wrapped) — whatever forwards customer traffic
 * upstream reconstructs the full brd.superproxy.io proxy-auth from it.
 */
export class BrightDataProviderAdapter implements ProviderAdapter {
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
        `Missing "${label}" credential for Bright Data — add it under Additional credentials at /admin/providers.`,
      );
    }
    return decryptSecret(cred.encryptedValue);
  }

  private async getZoneConfig() {
    const provider = await this.getProvider();
    const [customerId, zoneName, zonePassword] = await Promise.all([
      this.getCredential(provider.id, CRED.customerId),
      this.getCredential(provider.id, CRED.zoneName),
      this.getCredential(provider.id, CRED.zonePassword),
    ]);
    return { provider, customerId, zoneName, zonePassword };
  }

  private buildUsername(
    customerId: string,
    zoneName: string,
    params: { country?: string; region?: string; city?: string; sessionId?: string },
  ): string {
    const parts = [`brd-customer-${customerId}-zone-${zoneName}`];
    if (params.country) parts.push(`country-${params.country.toLowerCase()}`);
    // Bright Data only supports state-level targeting within the US.
    if (params.region && params.country?.toLowerCase() === "us") {
      parts.push(`state-${params.region.toLowerCase()}`);
    }
    if (params.city) parts.push(`city-${params.city.toLowerCase().replace(/\s+/g, "")}`);
    if (params.sessionId) parts.push(`session-${params.sessionId}`);
    return parts.join("-");
  }

  async createProxyCredential(
    params: CreateProxyCredentialParams,
  ): Promise<UpstreamProvisionResult> {
    const { customerId, zoneName } = await this.getZoneConfig();

    // Rotating sessions get a fresh exit IP per request by omitting the
    // -session- segment entirely; sticky sessions pin to one IP by always
    // sending the same session id for the requested duration.
    const sessionId =
      params.sessionType === "STICKY" ? randomBytes(6).toString("hex") : undefined;

    const username = this.buildUsername(customerId, zoneName, {
      country: params.country,
      region: params.region,
      city: params.city,
      sessionId,
    });

    return {
      upstreamSessionRef: JSON.stringify({ username, sessionType: params.sessionType }),
      exitCountry: params.country,
      // Bright Data doesn't hand back a specific exit IP synchronously — it's
      // assigned per-request from the pool, so this is only known once the
      // gateway actually forwards a request through this session.
      exitIp: undefined,
    };
  }

  async disableProxyCredential(_upstreamSessionRef: string): Promise<void> {
    // No revoke call exists for residential sessions — they're not
    // persistent objects upstream, so there's nothing to tear down. Unused
    // sticky sessions simply expire.
    return;
  }

  async updateProxyCredential(
    upstreamSessionRef: string,
    params: Partial<CreateProxyCredentialParams>,
  ): Promise<UpstreamProvisionResult> {
    const { customerId, zoneName } = await this.getZoneConfig();
    const prev = JSON.parse(upstreamSessionRef) as { username: string; sessionType?: string };
    const prevSessionMatch = prev.username.match(/-session-([a-z0-9]+)/);

    const username = this.buildUsername(customerId, zoneName, {
      country: params.country,
      region: params.region,
      city: params.city,
      sessionId: prevSessionMatch?.[1],
    });

    return {
      upstreamSessionRef: JSON.stringify({ username, sessionType: prev.sessionType }),
      exitCountry: params.country,
      exitIp: undefined,
    };
  }

  async getProxyUsage(query: ProxyUsageQuery): Promise<ProxyUsageResult> {
    const { provider, zoneName } = await this.getZoneConfig();
    const apiKey = await this.getCredential(provider.id, CRED.apiKey);

    const url = new URL("/zone/bw", CONTROL_API_BASE);
    url.searchParams.set("zone", zoneName);
    url.searchParams.set("from", query.since.toISOString());
    url.searchParams.set("to", new Date().toISOString());

    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
      throw new Error(`Bright Data bandwidth API returned ${res.status}`);
    }
    const body: unknown = await res.json();

    // Response nests bw_up/bw_dn/*_req arrays under a product-type key
    // (e.g. "static") that varies by zone type — sum whatever's there
    // rather than assuming one key name.
    let bytesUploaded = 0;
    let bytesDownloaded = 0;
    let requestCount = 0;
    for (const entry of Object.values(body as Record<string, unknown>)) {
      const data = (entry as { data?: Record<string, Record<string, number[]>> })?.data;
      if (!data) continue;
      for (const series of Object.values(data)) {
        bytesUploaded += sumArray(series.bw_up);
        bytesDownloaded += sumArray(series.bw_dn);
        requestCount += sumArray(series.http_direct_req) + sumArray(series.https_direct_req);
      }
    }

    return { bytesUploaded, bytesDownloaded, requestCount };
  }

  async getGatewayHealth(): Promise<GatewayHealthResult> {
    const { customerId, zoneName, zonePassword } = await this.getZoneConfig();
    const username = this.buildUsername(customerId, zoneName, {});

    const start = Date.now();
    try {
      await proxyTestRequest(username, zonePassword);
      return {
        status: "HEALTHY",
        latencyMs: Date.now() - start,
        successRatePercent: 100,
      };
    } catch {
      return {
        status: "OFFLINE",
        latencyMs: Date.now() - start,
        successRatePercent: 0,
      };
    }
  }

  async getAvailableLocations(_productSlug: string): Promise<LocationOption[]> {
    // Bright Data residential covers ~195 countries with no per-zone country
    // list endpoint — this is a curated set of the countries we actually
    // want to sell, not everything Bright Data offers. Extend as needed.
    return [
      { country: "US" }, { country: "GB" }, { country: "CA" }, { country: "DE" },
      { country: "FR" }, { country: "AU" }, { country: "JP" }, { country: "BR" },
      { country: "IN" }, { country: "MX" }, { country: "ES" }, { country: "IT" },
      { country: "NL" }, { country: "SE" }, { country: "SG" },
    ];
  }

  async getAvailableProducts(): Promise<ProductOption[]> {
    // No pricing-list API for a specific zone; costs are configured by hand
    // in the admin cost-config UI (per-Provider ProviderProduct rows), which
    // is the authoritative source the rest of the app already reads from.
    return [{ slug: "residential" }];
  }

  async getUpstreamConnection(upstreamSessionRef: string): Promise<UpstreamConnectionInfo> {
    const { zonePassword } = await this.getZoneConfig();
    const { username } = JSON.parse(upstreamSessionRef) as { username: string };
    return { host: PROXY_HOST, port: PROXY_PORT, username, password: zonePassword };
  }
}

function sumArray(values: number[] | undefined): number {
  return (values ?? []).reduce((sum, v) => sum + (v || 0), 0);
}

function proxyTestRequest(username: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const agent = new HttpsProxyAgent(
      `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${PROXY_HOST}:${PROXY_PORT}`,
    );
    const req = httpsRequest(
      "https://geo.brdtest.com/mygeo.json",
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
