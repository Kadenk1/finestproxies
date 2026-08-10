import type { ProviderAdapter } from "./types";
import { MockProviderAdapter } from "./mock-provider";
import { BrightDataProviderAdapter } from "./bright-data";
import { IPRoyalProviderAdapter } from "./iproyal";
import { RayobyteProviderAdapter } from "./rayobyte";

/**
 * Adapter factory. Add a real wholesale provider by implementing
 * `ProviderAdapter` in a new file here and registering it below — nothing
 * else in the app imports a concrete adapter, so this is the only file that
 * changes.
 */
const adapters: Record<string, () => ProviderAdapter> = {
  "mock-provider": () => new MockProviderAdapter(),
  "bright-data": () => new BrightDataProviderAdapter(),
  "iproyal": () => new IPRoyalProviderAdapter(),
  "rayobyte": () => new RayobyteProviderAdapter(),
};

export function getProviderAdapter(providerSlug: string): ProviderAdapter {
  const factory = adapters[providerSlug];
  if (!factory) {
    throw new Error(`No adapter registered for provider "${providerSlug}"`);
  }
  return factory();
}

/** Default adapter for development — the only provider seeded today. */
export function getDefaultProviderAdapter(): ProviderAdapter {
  return getProviderAdapter("mock-provider");
}
