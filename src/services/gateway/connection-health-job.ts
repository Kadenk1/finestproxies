import { recomputeHealthScores, RECOMPUTE_INTERVAL_MS } from "@/services/gateway/connection-health";

/**
 * Starts the periodic per-destination-per-pool health recompute, once per
 * server process. Guarded via globalThis (same pattern as prisma.ts/redis.ts)
 * so Next.js dev-mode hot-reload or multiple module evaluations never stack
 * up duplicate intervals — without the guard, every reload would add
 * another setInterval running the same aggregation query concurrently.
 *
 * Called from instrumentation.ts's register(), which Next.js guarantees
 * runs exactly once per server instance before it starts serving requests.
 */
export function startConnectionHealthJob() {
  if (globalThis.connectionHealthJobStarted) return;
  globalThis.connectionHealthJobStarted = true;

  const tick = async () => {
    try {
      const groupCount = await recomputeHealthScores();
      if (groupCount > 0) {
        console.log(`[connection-health] recomputed scores for ${groupCount} destination+pool pairs`);
      }
    } catch (err) {
      console.error("[connection-health] recompute failed:", err instanceof Error ? err.message : err);
    }
  };

  // Fire once immediately so scores exist before the first interval tick,
  // rather than leaving routing with zero destination-aware signal for the
  // first RECOMPUTE_INTERVAL_MS after every server restart.
  void tick();
  setInterval(tick, RECOMPUTE_INTERVAL_MS).unref();
}

declare global {
  var connectionHealthJobStarted: boolean | undefined;
}
