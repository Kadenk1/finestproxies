import type { ProxyProtocol, ProxySessionType, GatewayStatus } from "@/generated/prisma/enums";

/**
 * Everything the rest of the app knows about an upstream provider goes
 * through this interface. No code outside `src/services/providers` may
 * import a concrete adapter directly — callers ask the registry
 * (`getProviderAdapter`) for whichever adapter is configured, so swapping
 * or adding a wholesale provider never touches the dashboard, API routes,
 * or gateway service.
 */
export interface CreateProxyCredentialParams {
  productSlug: string;
  country?: string;
  region?: string;
  city?: string;
  protocol: ProxyProtocol;
  sessionType: ProxySessionType;
  sessionDurationMins?: number;
}

/**
 * Result of provisioning capacity on the upstream side. These fields are
 * upstream implementation details — `upstreamSessionRef` is the only piece
 * ever persisted (in `ProxySession.upstreamSessionRef`), and only as an
 * opaque reference. Nothing here is ever surfaced to a customer.
 */
export interface UpstreamProvisionResult {
  upstreamSessionRef: string;
  exitCountry?: string;
  exitIp?: string;
}

export interface ProxyUsageQuery {
  upstreamSessionRef: string;
  since: Date;
}

export interface ProxyUsageResult {
  bytesUploaded: number;
  bytesDownloaded: number;
  requestCount: number;
}

export interface GatewayHealthResult {
  status: GatewayStatus;
  latencyMs: number;
  successRatePercent: number;
}

export interface LocationOption {
  country: string;
  region?: string;
  city?: string;
}

export interface ProductOption {
  slug: string;
  costPerGb?: number;
  costPerIp?: number;
  costPerPort?: number;
}

export interface ProviderAdapter {
  readonly providerSlug: string;

  createProxyCredential(
    params: CreateProxyCredentialParams,
  ): Promise<UpstreamProvisionResult>;

  disableProxyCredential(upstreamSessionRef: string): Promise<void>;

  updateProxyCredential(
    upstreamSessionRef: string,
    params: Partial<CreateProxyCredentialParams>,
  ): Promise<UpstreamProvisionResult>;

  getProxyUsage(query: ProxyUsageQuery): Promise<ProxyUsageResult>;

  getGatewayHealth(): Promise<GatewayHealthResult>;

  getAvailableLocations(productSlug: string): Promise<LocationOption[]>;

  getAvailableProducts(): Promise<ProductOption[]>;
}
