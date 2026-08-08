/**
 * Recursively converts BigInt values to strings so objects (e.g. Prisma rows
 * with BigInt columns like Gateway.bandwidthBps) can pass through
 * NextResponse.json, which uses JSON.stringify and doesn't support BigInt.
 *
 * Only walks plain objects and arrays — Date, Decimal, and other class
 * instances are left untouched so their own serialization (toJSON) still
 * applies instead of being torn apart into their internal fields.
 */
export function serializeBigInts<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInts(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object" && value.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeBigInts(val);
    }
    return result as T;
  }
  return value;
}
