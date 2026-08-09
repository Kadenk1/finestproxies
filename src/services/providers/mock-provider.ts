import { randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/db/prisma";
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

const PROVIDER_SLUG = "mock-provider";

/**
 * Simulated upstream wholesale provider for development. Backs its
 * "capacity" and health with the seeded Provider/ProviderProduct/
 * ProviderLocation rows so the admin provider-management UI (Phase 3) has
 * something real to point at, while every network call is faked in-process
 * — no external dependency, no real bandwidth purchased.
 */
export class MockProviderAdapter implements ProviderAdapter {
  readonly providerSlug = PROVIDER_SLUG;

  private async getProviderRow() {
    const provider = await prisma.provider.findUnique({
      where: { slug: PROVIDER_SLUG },
    });
    if (!provider) {
      throw new Error(
        `Mock provider row not found — run \`npm run db:seed\` to create it.`,
      );
    }
    return provider;
  }

  async createProxyCredential(
    params: CreateProxyCredentialParams,
  ): Promise<UpstreamProvisionResult> {
    const provider = await this.getProviderRow();

    if (provider.healthStatus === "OFFLINE" || !provider.enabled) {
      throw new Error("Upstream provider is currently unavailable.");
    }

    // Simulate an occasional transient provisioning failure so the gateway
    // service's error handling path is exercised in development.
    if (provider.healthStatus === "DEGRADED" && randomInt(0, 10) === 0) {
      throw new Error("Upstream provider request timed out.");
    }

    return {
      upstreamSessionRef: `mock_sess_${randomBytes(12).toString("hex")}`,
      exitCountry: params.country ?? "US",
      exitIp: fakeIp(),
    };
  }

  async disableProxyCredential(_upstreamSessionRef: string): Promise<void> {
    // Mock upstream has no persistent session state to tear down.
    return;
  }

  async updateProxyCredential(
    upstreamSessionRef: string,
    params: Partial<CreateProxyCredentialParams>,
  ): Promise<UpstreamProvisionResult> {
    return {
      upstreamSessionRef,
      exitCountry: params.country ?? "US",
      exitIp: fakeIp(),
    };
  }

  async getProxyUsage(_query: ProxyUsageQuery): Promise<ProxyUsageResult> {
    return {
      bytesUploaded: randomInt(1_000_000, 50_000_000),
      bytesDownloaded: randomInt(10_000_000, 500_000_000),
      requestCount: randomInt(50, 5000),
    };
  }

  async getGatewayHealth(): Promise<GatewayHealthResult> {
    const provider = await this.getProviderRow();
    const jitter = randomInt(-8, 8);
    return {
      status: provider.healthStatus,
      latencyMs: Math.max(5, (provider.currentLatencyMs ?? 40) + jitter),
      successRatePercent: provider.successRatePercent
        ? Number(provider.successRatePercent)
        : 99,
    };
  }

  async getAvailableLocations(productSlug: string): Promise<LocationOption[]> {
    const product = await prisma.product.findUnique({
      where: { slug: productSlug },
      include: { locations: { where: { available: true } } },
    });
    if (!product) return [];
    return product.locations.map((loc) => ({
      country: loc.country,
      region: loc.region ?? undefined,
      city: loc.city ?? undefined,
    }));
  }

  async getAvailableProducts(): Promise<ProductOption[]> {
    const provider = await this.getProviderRow();
    const providerProducts = await prisma.providerProduct.findMany({
      where: { providerId: provider.id, active: true },
      include: { product: true },
    });
    return providerProducts.map((pp) => ({
      slug: pp.product.slug,
      costPerGb: pp.costPerGb ? Number(pp.costPerGb) : undefined,
      costPerIp: pp.costPerIp ? Number(pp.costPerIp) : undefined,
      costPerPort: pp.costPerPort ? Number(pp.costPerPort) : undefined,
    }));
  }

  async getUpstreamConnection(_upstreamSessionRef: string): Promise<UpstreamConnectionInfo> {
    throw new Error("Mock provider has no real upstream — nothing to connect to.");
  }
}

function fakeIp(): string {
  return `${randomInt(1, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}
