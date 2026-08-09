import { randomInt, randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";

export const BYTES_PER_GB = 1024 ** 3;

export interface RecordUsageEventInput {
  userId: string;
  productId: string;
  gatewayId: string;
  providerId: string;
  credentialId?: string | null;
  bytesUploaded: number;
  bytesDownloaded: number;
  requestCount: number;
  occurredAt?: Date;
  /** Caller-supplied idempotency key — the same event delivered twice must
   * only ever be applied once. */
  dedupeKey: string;
}

/**
 * Bandwidth accounting entry point. Every byte counted against a customer
 * goes through here so the dedupe guarantee is centralized: a UsageRecord
 * with a given `dedupeKey` can only ever exist once (unique constraint),
 * and the balance decrement only happens the first time that record is
 * successfully inserted.
 */
export async function recordUsageEvent(input: RecordUsageEventInput) {
  const totalBytes = input.bytesUploaded + input.bytesDownloaded;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.usageRecord.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });
    if (existing) {
      // Already applied — this is what makes replayed/duplicate usage
      // events safe to retry from a gateway agent.
      return existing;
    }

    const record = await tx.usageRecord.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        gatewayId: input.gatewayId,
        providerId: input.providerId,
        credentialId: input.credentialId ?? null,
        dedupeKey: input.dedupeKey,
        bytesUploaded: BigInt(input.bytesUploaded),
        bytesDownloaded: BigInt(input.bytesDownloaded),
        totalBytes: BigInt(totalBytes),
        requestCount: input.requestCount,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    // Real bytes only mean something for a GB-billed product — deplete the
    // right balance field for whichever billing model this product
    // actually uses, rather than always touching remainingBytes regardless.
    // IP_MONTH/PORT_MONTH/FLAT are intentionally not byte-metered (that's
    // the whole point of those billing models — pay per IP/port/flat fee,
    // not per GB) — usage is still recorded above for visibility, it just
    // doesn't deplete remainingUnits, since bytes don't map onto "units" in
    // any well-defined way for those.
    const [balance, product] = await Promise.all([
      tx.productBalance.findUnique({
        where: { userId_productId: { userId: input.userId, productId: input.productId } },
      }),
      tx.product.findUnique({ where: { id: input.productId }, select: { billingUnit: true } }),
    ]);
    if (balance && product?.billingUnit === "GB") {
      const remaining = balance.remainingBytes - BigInt(totalBytes);
      await tx.productBalance.update({
        where: { id: balance.id },
        data: { remainingBytes: remaining < 0n ? 0n : remaining },
      });
    }

    return record;
  });
}

/**
 * Dev-mode convenience: simulates a burst of proxy traffic through a
 * credential so the dashboard has fresh usage to show without needing real
 * traffic. Mirrors what a gateway agent's usage-reporting webhook will send
 * once real infrastructure exists.
 */
export async function simulateUsageForCredential(
  userId: string,
  credentialId: string,
) {
  const credential = await prisma.customerProxyCredential.findFirst({
    where: { id: credentialId, userId },
    include: {
      product: true,
      sessions: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  if (!credential) throw new Error("Credential not found");

  const balance = await prisma.productBalance.findUnique({
    where: { userId_productId: { userId, productId: credential.productId } },
  });
  if (!balance || balance.remainingBytes <= 0n) {
    throw new Error("No remaining balance for this product.");
  }

  const providerId = credential.sessions[0]?.providerId;
  if (!providerId) throw new Error("Credential has no active session to attribute usage to.");

  const bytesDownloaded = randomInt(5_000_000, 400_000_000);
  const bytesUploaded = Math.round(bytesDownloaded * 0.08);

  const record = await recordUsageEvent({
    userId,
    productId: credential.productId,
    gatewayId: credential.gatewayId,
    providerId,
    credentialId: credential.id,
    bytesUploaded,
    bytesDownloaded,
    requestCount: randomInt(20, 800),
    dedupeKey: `sim_${randomUUID()}`,
  });

  await prisma.customerProxyCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return record;
}

export function bytesToGb(bytes: bigint | number): number {
  return Number(bytes) / BYTES_PER_GB;
}

export function gbToBytes(gb: number): bigint {
  return BigInt(Math.round(gb * BYTES_PER_GB));
}
