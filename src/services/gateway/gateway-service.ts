import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { getProviderAdapter } from "@/services/providers/registry";
import { selectRoute } from "@/services/routing/routing-engine";
import { gatewayHosts, gatewayPorts } from "@/lib/config/brand";
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

function hostFor(productSlug: string): string {
  switch (productSlug) {
    case "residential":
      return gatewayHosts.residential;
    case "isp":
      return gatewayHosts.isp;
    case "mobile":
      return gatewayHosts.mobile;
    default:
      return gatewayHosts.generic;
  }
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
 * Orchestrates issuing a customer-facing proxy credential. This is the one
 * place that bridges "what the customer asked for" and "which upstream
 * provider actually serves it" — everything downstream (dashboard, API)
 * only ever sees OUR gateway hostnames and credentials we generate here,
 * never the upstream's.
 */
export async function generateProxyCredential(
  input: GenerateCredentialInput,
): Promise<GeneratedCredential> {
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
  const upstream = await adapter.createProxyCredential({
    productSlug: input.productSlug,
    country: input.country,
    region: input.region,
    city: input.city,
    protocol: input.protocol,
    sessionType: input.sessionType,
    sessionDurationMins: input.sessionDurationMins,
  });

  const username = `cg_${alphanumeric(12)}`;
  const password = alphanumeric(20);
  const expiresAt =
    input.sessionType === "STICKY" && input.sessionDurationMins
      ? new Date(Date.now() + input.sessionDurationMins * 60_000)
      : null;

  const credential = await prisma.$transaction(async (tx) => {
    const created = await tx.customerProxyCredential.create({
      data: {
        userId: input.userId,
        productId: product.id,
        gatewayId: route.gatewayId,
        label: input.label,
        username,
        passwordEnc: encryptSecret(password),
        protocol: input.protocol,
        sessionType: input.sessionType,
        country: input.country,
        region: input.region,
        city: input.city,
        sessionDurationMins: input.sessionDurationMins,
        expiresAt,
      },
    });

    await tx.proxySession.create({
      data: {
        credentialId: created.id,
        gatewayId: route.gatewayId,
        providerId: route.providerId,
        upstreamSessionRef: upstream.upstreamSessionRef,
        exitCountry: upstream.exitCountry,
        exitIp: upstream.exitIp,
      },
    });

    return created;
  });

  return {
    id: credential.id,
    host: hostFor(product.slug),
    port: portFor(input.protocol),
    username,
    password,
    protocol: credential.protocol,
    sessionType: credential.sessionType,
    country: credential.country,
    region: credential.region,
    city: credential.city,
    createdAt: credential.createdAt,
  };
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
