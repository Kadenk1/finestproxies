import { randomUUID } from "crypto";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { getProviderAdapter } from "@/services/providers/registry";
import { selectRoute } from "@/services/routing/routing-engine";
import { gatewayPorts } from "@/lib/config/brand";
import type { ProxyProtocol, ProxySessionType } from "@/generated/prisma/enums";

const alphanumeric = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
);

export interface GenerateCredentialInput {
  userId: string;
  productSlug: string;
  country?: string;
  region?: string;
  city?: string;
  protocol: ProxyProtocol;
  sessionType: ProxySessionType;
  sessionDurationMins?: number;
  label?: string;
}

export interface GeneratedCredential {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: ProxyProtocol;
  sessionType: ProxySessionType;
  country: string | null;
  region: string | null;
  city: string | null;
  createdAt: Date;
}


function portFor(protocol: ProxyProtocol): number {
  return protocol === "SOCKS5" ? gatewayPorts.socks5 : gatewayPorts.http;
}

export class InsufficientBalanceError extends Error {
  constructor(productSlug: string) {
    super(`No remaining balance for product "${productSlug}".`);
    this.name = "InsufficientBalanceError";
  }
}

export class NoAvailableRouteError extends Error {
  constructor(productSlug: string) {
    super(`No gateway route is currently available for "${productSlug}".`);
    this.name = "NoAvailableRouteError";
  }
}

/**
 * Orchestrates issuing customer-facing proxy credentials in bulk. This is
 * the one place that bridges "what the customer asked for" and "which
 * upstream provider actually serves it" — everything downstream (dashboard,
 * API) only ever sees OUR gateway hostnames and credentials we generate
 * here, never the upstream's.
 *
 * Product/balance/route lookup and the provider adapter are resolved once
 * regardless of quantity, and the two credential/session tables are
 * populated via a single createMany each rather than one transaction per
 * credential — issuing a list of a few thousand is a couple of seconds of
 * work, not a request that hangs for minutes. The adapter itself memoizes
 * its own account-credential fetch (see bright-data.ts / iproyal.ts), so
 * concurrently calling createProxyCredential() per item doesn't turn into
 * one DB round-trip per item either.
 */
export async function generateProxyCredentials(
  input: GenerateCredentialInput,
  quantity: number,
): Promise<GeneratedCredential[]> {
  const product = await prisma.product.findUnique({
    where: { slug: input.productSlug },
  });
  if (!product || !product.active) {
    throw new Error(`Unknown or inactive product "${input.productSlug}"`);
  }

  const balance = await prisma.productBalance.findUnique({
    where: { userId_productId: { userId: input.userId, productId: product.id } },
  });
  const hasBalance =
    balance &&
    (balance.remainingBytes > 0n || Number(balance.remainingUnits) > 0);
  if (!hasBalance) {
    throw new InsufficientBalanceError(input.productSlug);
  }

  const selected = await selectRoute(product.id, input.country);
  if (!selected) {
    throw new NoAvailableRouteError(input.productSlug);
  }
  const route = await prisma.gatewayRoute.findUniqueOrThrow({
    where: { id: selected.routeId },
    include: { gateway: true, provider: true },
  });

  const adapter = getProviderAdapter(route.provider.slug);
  const expiresAt =
    input.sessionType === "STICKY" && input.sessionDurationMins
      ? new Date(Date.now() + input.sessionDurationMins * 60_000)
      : null;

  const items = await Promise.all(
    Array.from({ length: quantity }, async () => {
      const upstream = await adapter.createProxyCredential({
        productSlug: input.productSlug,
        country: input.country,
        region: input.region,
        city: input.city,
        protocol: input.protocol,
        sessionType: input.sessionType,
        sessionDurationMins: input.sessionDurationMins,
      });
      return {
        id: randomUUID(),
        username: `cg_${alphanumeric(12)}`,
        password: alphanumeric(20),
        upstream,
      };
    }),
  );

  const createdAt = new Date();
  await prisma.$transaction([
    prisma.customerProxyCredential.createMany({
      data: items.map((item) => ({
        id: item.id,
        userId: input.userId,
        productId: product.id,
        gatewayId: route.gatewayId,
        label: input.label,
        username: item.username,
        passwordEnc: encryptSecret(item.password),
        protocol: input.protocol,
        sessionType: input.sessionType,
        country: input.country,
        region: input.region,
        city: input.city,
        sessionDurationMins: input.sessionDurationMins,
        expiresAt,
        createdAt,
      })),
    }),
    prisma.proxySession.createMany({
      data: items.map((item) => ({
        credentialId: item.id,
        gatewayId: route.gatewayId,
        providerId: route.providerId,
        upstreamSessionRef: item.upstream.upstreamSessionRef,
        exitCountry: item.upstream.exitCountry,
        exitIp: item.upstream.exitIp,
      })),
    }),
  ]);

  return items.map((item) => ({
    id: item.id,
    host: route.gateway.hostname,
    port: portFor(input.protocol),
    username: item.username,
    password: item.password,
    protocol: input.protocol,
    sessionType: input.sessionType,
    country: input.country ?? null,
    region: input.region ?? null,
    city: input.city ?? null,
    createdAt,
  }));
}

export async function generateProxyCredential(
  input: GenerateCredentialInput,
): Promise<GeneratedCredential> {
  const [credential] = await generateProxyCredentials(input, 1);
  return credential;
}

export async function revokeProxyCredential(
  userId: string,
  credentialId: string,
  reason?: string,
) {
  const credential = await prisma.customerProxyCredential.findFirst({
    where: { id: credentialId, userId },
    include: {
      sessions: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  if (!credential) throw new Error("Credential not found");

  const latestSession = credential.sessions[0];
  if (latestSession?.upstreamSessionRef) {
    const providerRoute = await prisma.gatewayRoute.findFirst({
      where: { gatewayId: credential.gatewayId },
      include: { provider: true },
    });
    if (providerRoute) {
      const adapter = getProviderAdapter(providerRoute.provider.slug);
      await adapter
        .disableProxyCredential(latestSession.upstreamSessionRef)
        .catch(() => {});
    }
  }

  await prisma.customerProxyCredential.update({
    where: { id: credentialId },
    data: {
      status: "DISABLED",
      revokedAt: new Date(),
      revokedReason: reason ?? "Revoked by customer",
    },
  });
}

export async function regenerateProxyCredential(
  userId: string,
  credentialId: string,
): Promise<GeneratedCredential> {
  const existing = await prisma.customerProxyCredential.findFirst({
    where: { id: credentialId, userId },
    include: { product: true },
  });
  if (!existing) throw new Error("Credential not found");

  await revokeProxyCredential(userId, credentialId, "Replaced by regeneration");

  return generateProxyCredential({
    userId,
    productSlug: existing.product.slug,
    country: existing.country ?? undefined,
    region: existing.region ?? undefined,
    city: existing.city ?? undefined,
    protocol: existing.protocol,
    sessionType: existing.sessionType,
    sessionDurationMins: existing.sessionDurationMins ?? undefined,
    label: existing.label ?? undefined,
  });
}

/** Decrypts a credential's password for one-time display to its owner only. */
export function revealCredentialPassword(passwordEnc: string): string {
  return decryptSecret(passwordEnc);
}
