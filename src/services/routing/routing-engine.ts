import { prisma } from "@/lib/db/prisma";
import { getSiteRoutingProfile, resolveDestinationPattern } from "@/lib/config/gateway-tuning";
import { getDestinationHealthMap, PROBE_CHANCE } from "@/services/gateway/connection-health";

export interface SelectedRoute {
  routeId: string;
  gatewayId: string;
  providerId: string;
  score: number;
}

// ---- Destination-aware scoring adjustments -------------------------------
//
// Layered on top of the existing global signals below (priority/weight,
// gateway+provider health, latency, cost, country) — never replacing them.
// A destination with no SiteRule and no health data yet scores identically
// to before this existed; these are additive bonuses/penalties that only
// activate once there's a hostname and/or per-destination history to act on.

const PREFERRED_PROVIDER_BONUS = 150; // enough to usually outweigh a moderate global health/latency gap, not enough to override a genuinely OFFLINE/unhealthy provider (which is filtered out before scoring)
const FALLBACK_PROVIDER_BONUS = 40; // smaller bump — "acceptable if preferred isn't available," not "equally preferred"
const DESTINATION_SUCCESS_RATE_WEIGHT = 1.5; // per-destination success rate matters more here than the provider's global successRatePercent (weight 1 below), since it reflects this specific destination's reality
const DESTINATION_LATENCY_WEIGHT = 0.6;
const DEGRADED_SCORE_PENALTY = 300; // large enough to lose to almost any non-degraded alternative, but NOT exclusionary — see PROBE_CHANCE in connection-health.ts for why hard-excluding would prevent recovery

/**
 * Chooses which gateway/provider pair should serve a request for a given
 * product (and optionally a requested country). Scoring is built entirely
 * from legitimate reliability/availability/performance/cost signals —
 * administrator-defined priority and weight, gateway and provider health,
 * latency, success rate, upstream cost, geographic fit, and — when a
 * destination hostname is known — that destination's own preferred/fallback
 * pool configuration and rolling per-destination health (see
 * connection-health.ts). There is nothing here that targets CAPTCHAs, bans,
 * or anti-bot/anti-abuse systems; this only ever decides which of OUR
 * authorized upstreams handles a request.
 *
 * hostname is optional and additive — omitting it (e.g. at credential
 * issuance, before any destination is known) reproduces the exact global
 * scoring this function had before destination-awareness existed.
 *
 * Replaces the "first enabled route, ordered by priority" placeholder used
 * by `gateway-service` in Phase 2.
 */
export async function selectRoute(
  productId: string,
  country?: string,
  hostname?: string,
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

  // Resolved once for the whole candidate set, not per-candidate — a
  // single hostname always maps to one destination pattern and one routing
  // profile regardless of which provider ends up scoring highest.
  const [destinationPattern, routingProfile] = hostname
    ? await Promise.all([resolveDestinationPattern(hostname), getSiteRoutingProfile(hostname)])
    : [null, null];
  const healthByProviderSlug = destinationPattern
    ? await getDestinationHealthMap(
        destinationPattern,
        candidates.map((r) => r.provider.slug),
      )
    : new Map();

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

    // Historical success rate (global, all destinations).
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

    // Geographic fit: the destination's own region preference (routingProfile)
    // takes precedence over the request-level `country` param when both are
    // present, since it's a more specific signal about what this particular
    // destination needs; falls back to `country` otherwise. Bonus, not
    // exclusionary — falls back gracefully when no provider has explicit
    // coverage data for the requested country.
    const effectiveCountry = routingProfile?.region ?? country;
    if (effectiveCountry) {
      const hasLocation = route.provider.locations.some(
        (loc) => loc.country === effectiveCountry.toUpperCase(),
      );
      if (hasLocation) score += 75;
    }

    // Destination routing profile: preferred/fallback pool preference.
    if (routingProfile?.preferredProviderSlug === route.provider.slug) {
      score += PREFERRED_PROVIDER_BONUS;
    } else if (routingProfile?.fallbackProviderSlugs.includes(route.provider.slug)) {
      score += FALLBACK_PROVIDER_BONUS;
    }
    if (routingProfile?.routingWeight) {
      score += routingProfile.routingWeight - 100; // relative to the implicit default weight of 100
    }

    // Per-destination rolling health (see connection-health.ts) — this is
    // what lets the same provider score differently for Target vs. Walmart
    // instead of only ever reflecting its GLOBAL success rate/latency above.
    const destinationHealth = healthByProviderSlug.get(route.provider.slug);
    if (destinationHealth) {
      score += (destinationHealth.successRatePercent - 100) * DESTINATION_SUCCESS_RATE_WEIGHT;
      if (destinationHealth.p95LatencyMs !== null) {
        score -= destinationHealth.p95LatencyMs * DESTINATION_LATENCY_WEIGHT;
      }
      if (destinationHealth.degraded) {
        score -= DEGRADED_SCORE_PENALTY;
      }
    }

    return {
      routeId: route.id,
      gatewayId: route.gatewayId,
      providerId: route.providerId,
      providerSlug: route.provider.slug,
      degraded: destinationHealth?.degraded ?? false,
      score,
    };
  });

  // Recovery probing (see connection-health.ts's PROBE_CHANCE doc comment):
  // a degraded pool that's always outscored would never get picked again
  // and therefore never generate the fresh events needed to prove it's
  // recovered. A small random chance ignores the degraded penalty for this
  // one decision so degraded candidates occasionally get a real shot.
  const probedScored = scored.map((s) =>
    s.degraded && Math.random() < PROBE_CHANCE ? { ...s, score: s.score + DEGRADED_SCORE_PENALTY } : s,
  );

  probedScored.sort((a, b) => b.score - a.score);
  const winner = probedScored[0];
  return { routeId: winner.routeId, gatewayId: winner.gatewayId, providerId: winner.providerId, score: winner.score };
}
