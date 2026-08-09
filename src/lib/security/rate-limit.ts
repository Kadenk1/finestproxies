import { randomUUID } from "crypto";
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
  amount = 1,
): Promise<RateLimitResult> {
  const bucketKey = `ratelimit:${key}`;
  try {
    const count = await redis.incrby(bucketKey, amount);
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

/**
 * Runs `fn` while holding a short Redis lock on `key`, so concurrent callers
 * serialize instead of racing. Built for resolveActiveUpstreamSession: a
 * single page load fires many near-simultaneous CONNECTs on one customer
 * credential (main site + hCaptcha's own domains + assets), and without this
 * each one independently reads "is the sticky session expired" and
 * independently rotates — every concurrent request minting its own new exit
 * IP. That splits one browser session across several exit IPs mid-flow,
 * which is exactly the shape of thing that makes hCaptcha's own follow-up
 * calls fail with a session-mismatch/rate-limit error, since they're now
 * arriving from an IP hCaptcha has no context for.
 *
 * A caller that fails to acquire the lock (someone else is already
 * resolving/rotating this same credential) waits briefly for it to clear
 * and then just runs `fn` anyway rather than blocking indefinitely or
 * failing the request — `fn` re-reads current DB state itself, so by the
 * time the lock holder has finished rotating, the waiter's own read/decide
 * naturally sees the already-rotated session and reuses it instead of
 * rotating again.
 *
 * Fails open on a Redis error, same as checkRateLimit — an unreachable lock
 * store should degrade back to the pre-lock (racy but functional) behavior,
 * not break credential resolution outright.
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  { ttlMs = 5_000, waitMs = 3_000, pollMs = 100 }: { ttlMs?: number; waitMs?: number; pollMs?: number } = {},
): Promise<T> {
  const lockKey = `lock:${key}`;
  const token = randomUUID();
  const deadline = Date.now() + waitMs;

  try {
    while (Date.now() < deadline) {
      const acquired = await redis.set(lockKey, token, "PX", ttlMs, "NX");
      if (acquired) {
        try {
          return await fn();
        } finally {
          // Only clear the lock if we still own it — a lock we let expire
          // under us may have already been picked up by the next waiter.
          const current = await redis.get(lockKey).catch(() => null);
          if (current === token) await redis.del(lockKey).catch(() => {});
        }
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  } catch {
    // Redis unreachable — fall through to running fn without a lock.
  }
  return fn();
}
