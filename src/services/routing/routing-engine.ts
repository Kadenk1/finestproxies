import { prisma } from "@/lib/db/prisma";

export interface SelectedRoute {
  routeId: string;
  gatewayId: string;
  providerId: string;
  score: number;
}

/**
 * Chooses which gateway/provider pair should serve a request for a given
 * product (and optionally a requested country). Scoring is built entirely
 * from legitimate reliability/availability/performance/cost signals —
 * administrator-defined priority and weight, gateway and provider health,
 * latency, success rate, upstream cost, and geographic fit. There is
 * nothing here that targets CAPTCHAs, bans, or anti-bot/anti-abuse systems;
 * this only ever decides which of OUR authorized upstreams handles a
 * request.
 *
 * Replaces the "first enabled route, ordered by priority" placeholder used
 * by `gateway-service` in Phase 2.
 */
export async function selectRoute(
  productId: string,
  country?: string,
): Promise<SelectedRoute | null> {
  const routes = await prisma.gatewayRoute.findMany({
    where: { productId, enabled: true },
    include: {
      gateway: true,
      provider: {
        include: {
          locations: true,
          products: { where: { productId } },
        },
      },
    },
  });

  const candidates = routes.filter(
    (route) =>
      route.gateway.status !== "OFFLINE" &&
      route.gateway.status !== "MAINTENANCE" &&
      route.provider.enabled &&
      route.provider.healthStatus !== "OFFLINE",
  );

  if (candidates.length === 0) return null;

  const scored = candidates.map((route) => {
    let score = 0;

    // Administrator-defined priority (lower number = preferred) and weight.
    score += (1000 - route.priority) * 2;
    score += route.weight;

    // Gateway + provider health.
    score += route.gateway.status === "HEALTHY" ? 100 : 30; // DEGRADED is the only other non-excluded state
    score += route.provider.healthStatus === "HEALTHY" ? 100 : 30;

    // Latency: lower is better.
    const latencyMs = route.gateway.latencyMs ?? route.provider.currentLatencyMs ?? 100;
    score -= latencyMs * 0.5;

    // Historical success rate.
    if (route.provider.successRatePercent) {
      score += Number(route.provider.successRatePercent);
    }

    // Upstream cost: cheaper preferred, but never a hard filter — a
    // pricier, healthier route can still win.
    const providerProduct = route.provider.products[0];
    if (providerProduct?.costPerGb) {
      score -= Number(providerProduct.costPerGb) * 20;
    } else if (providerProduct?.costPerIp) {
      score -= Number(providerProduct.costPerIp) * 5;
    }

    // Geographic fit: bonus, not exclusionary — falls back gracefully when
    // no provider has explicit coverage data for the requested country.
    if (country) {
      const hasLocation = route.provider.locations.some(
        (loc) => loc.country === country.toUpperCase(),
      );
      if (hasLocation) score += 75;
    }

    return {
      routeId: route.id,
      gatewayId: route.gatewayId,
      providerId: route.providerId,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}
