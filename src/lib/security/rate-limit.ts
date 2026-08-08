import { redis } from "@/lib/db/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis. Used for login brute-force
 * protection and general API abuse limits. Fails open (allows the request)
 * if Redis is unreachable, so a cache outage doesn't take the whole app down —
 * callers that need a hard fail-closed limit should catch and decide otherwise.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const bucketKey = `ratelimit:${key}`;
  try {
    const count = await redis.incr(bucketKey);
    if (count === 1) {
      await redis.expire(bucketKey, windowSeconds);
    }
    const ttl = await redis.ttl(bucketKey);
    const resetSeconds = ttl > 0 ? ttl : windowSeconds;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds,
    };
  } catch {
    return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
  }
}
