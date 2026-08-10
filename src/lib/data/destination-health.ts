import { prisma } from "@/lib/db/prisma";
import { getDestinationPoolHealth, type DestinationPoolHealth } from "@/services/gateway/connection-health";

export interface DestinationHealthRow extends DestinationPoolHealth {
  /** True if this pair has recent raw events but no cached score yet (e.g.
   * the background recompute job hasn't run since the server last
   * restarted) — shown distinctly in the UI rather than silently omitted. */
  scorePending: boolean;
}

/**
 * Every (destinationPattern, providerSlug) pair with at least one
 * ConnectionEvent in the last 24h, joined with its cached rolling health
 * (see connection-health.ts) — this is what the admin Destination Health
 * page renders. Deliberately queries raw ConnectionEvent for the *list* of
 * pairs (cheap, indexed) rather than scanning Redis keys, then batch-reads
 * cached scores for just that list.
 */
export async function getDestinationHealthRows(): Promise<DestinationHealthRow[]> {
  const since = new Date(Date.now() - 24 * 60 * 60_000);

  const pairs = await prisma.connectionEvent.groupBy({
    by: ["destinationPattern", "providerSlug"],
    where: { occurredAt: { gte: since } },
    _count: { _all: true },
  });

  const rows = await Promise.all(
    pairs.map(async ({ destinationPattern, providerSlug }) => {
      const health = await getDestinationPoolHealth(destinationPattern, providerSlug);
      if (health) return { ...health, scorePending: false };
      return {
        destinationPattern,
        providerSlug,
        totalAttempts: 0,
        successfulConnects: 0,
        failedConnects: 0,
        timeoutCount: 0,
        tcpFailureCount: 0,
        tlsFailureCount: 0,
        successRatePercent: 0,
        medianLatencyMs: null,
        p95LatencyMs: null,
        bytesUploaded: 0,
        bytesDownloaded: 0,
        activeSessions: 0,
        degraded: false,
        windowStart: since.toISOString(),
        windowEnd: new Date().toISOString(),
        scorePending: true,
      } satisfies DestinationHealthRow;
    }),
  );

  rows.sort((a, b) => {
    if (a.destinationPattern !== b.destinationPattern) {
      return a.destinationPattern.localeCompare(b.destinationPattern);
    }
    return b.successRatePercent - a.successRatePercent;
  });

  return rows;
}
