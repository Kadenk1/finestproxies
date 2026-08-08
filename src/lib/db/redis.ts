import Redis from "ioredis";

const createRedisClient = () => {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 2000,
    // Stop reconnecting after a couple of tries so an unavailable Redis
    // fails fast instead of hanging every request that touches it — callers
    // like checkRateLimit are written to fail open when this rejects.
    retryStrategy: (times) => (times > 2 ? null : 300),
  });
  // ioredis crashes the process on an unhandled 'error' event — swallow and
  // let callers (e.g. checkRateLimit) fail open instead.
  client.on("error", () => {});
  return client;
};

declare global {
  var redisGlobal: ReturnType<typeof createRedisClient> | undefined;
}

export const redis = globalThis.redisGlobal ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.redisGlobal = redis;
}
