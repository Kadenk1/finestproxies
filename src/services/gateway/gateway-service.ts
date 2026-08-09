import { randomUUID } from "crypto";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { getProviderAdapter } from "@/services/providers/registry";
import { selectRoute } from "@/services/routing/routing-engine";
import { classifyExitIp } from "@/services/gateway/exit-ip-classifier";
import { gatewayPorts } from "@/lib/config/brand";
import type { ProxyProtocol, ProxySessionType } from "@/generated/prisma/enums";

const alphanumeric = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
);

/**
 * sessionDurationMins is how long a STICKY session pins to one exit IP —
 * it is NOT how long the customer's credential (username/password to our
 * gateway) stays valid. Those used to be conflated: CustomerProxyCredential
 * .expiresAt was set from this duration, so the whole credential died the
 * moment the sticky window closed instead of just rotating to a new IP.
 * The credential now has no auto-expiry; resolveActiveUpstreamSession()
 * below is what actually enforces the sticky window, by minting a fresh
 * upstream session (new IP) once the current one is older than this many
 * minutes, transparently, on the customer's next request.
 */
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

  // For a RESIDENTIAL product, customers reasonably expect every exit IP to
  // actually be residential — not a mobile-carrier ASN (T-Mobile, Verizon
  // Wireless, etc.), which upstream pools can include since carrier "Home
  // Internet"/fixed-wireless products register on the same ASN as phones.
  // Verifying that requires one live request through each freshly-minted
  // session (see exit-ip-classifier.ts) — cheap for a handful of
  // credentials, but multiplying that by a 5,000-credential batch would
  // turn a ~4s request into many minutes and burn real upstream bandwidth
  // on retries. Only applied below this threshold; larger batches skip the
  // check entirely and get whatever the pool hands back, same as before.
  const MOBILE_CHECK_MAX_QUANTITY = 25;
  const MOBILE_CHECK_MAX_ATTEMPTS = 4;
  const shouldCheckMobile = product.type === "RESIDENTIAL" && quantity <= MOBILE_CHECK_MAX_QUANTITY;

  const mintUpstream = () =>
    adapter.createProxyCredential({
      productSlug: input.productSlug,
      country: input.country,
      region: input.region,
      city: input.city,
      protocol: input.protocol,
      sessionType: input.sessionType,
      sessionDurationMins: input.sessionDurationMins,
    });

  const items = await Promise.all(
    Array.from({ length: quantity }, async () => {
      let upstream = await mintUpstream();

      if (shouldCheckMobile) {
        for (let attempt = 1; attempt < MOBILE_CHECK_MAX_ATTEMPTS; attempt++) {
          const connection = await adapter.getUpstreamConnection(upstream.upstreamSessionRef);
          const classification = await classifyExitIp(
            connection.host,
            connection.port,
            connection.username,
            connection.password,
          );
          // Unknown (classifier unreachable) -> fail open, keep this one.
          // Confirmed non-mobile -> done. Only a confirmed mobile ASN
          // triggers a retry with a fresh (randomized) session.
          if (!classification || !classification.mobile) break;
          console.log(
            `[gateway] exit IP ${classification.ip} (${classification.isp}) is a mobile-carrier ASN, retrying (attempt ${attempt}/${MOBILE_CHECK_MAX_ATTEMPTS - 1})`,
          );
          upstream = await mintUpstream();
        }
      }

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

/**
 * Called by the Gateway Control API's /resolve endpoint on every new
 * connection. For a ROTATING credential this just returns its one
 * permanent session (each generated credential is already pinned to its
 * own distinct exit IP — see the IPRoyal/Bright Data adapters). For STICKY,
 * it checks whether the current session has outlived sessionDurationMins;
 * if so, it mints a fresh upstream session (new exit IP) and persists it,
 * closing out the old one — the credential itself never expires because of
 * this, only the exit IP behind it changes.
 *
 * forceRotate bypasses both of those checks and always mints a fresh
 * session — the gateway agent sets this on a retry after the current exit
 * IP failed to reach a target (timeout, upstream 5xx, etc.), so a single
 * bad IP doesn't take down every subsequent request on that credential.
 *
 * Both rotation paths re-run selectRoute() rather than assuming the
 * credential's original provider — the same health/priority/latency
 * scoring used at issuance, re-evaluated live. If the original provider
 * has since gone unhealthy (or a better-scoring one is now available),
 * rotation lands on a different provider automatically instead of
 * repeatedly retrying a provider that's currently down. Falls back to the
 * original provider if no route is currently available (e.g. everything's
 * degraded) rather than failing outright.
 */
export async function resolveActiveUpstreamSession(
  credentialId: string,
  forceRotate = false,
) {
  const credential = await prisma.customerProxyCredential.findUniqueOrThrow({
    where: { id: credentialId },
    include: {
      product: true,
      sessions: { orderBy: { startedAt: "desc" }, take: 1, include: { provider: true } },
    },
  });

  const currentSession = credential.sessions[0];
  if (!currentSession) {
    throw new Error("Credential has no session.");
  }

  const sessionAgeMs = Date.now() - currentSession.startedAt.getTime();
  const stickyWindowMs = (credential.sessionDurationMins ?? 0) * 60_000;
  const sessionExpired =
    credential.sessionType === "STICKY" && stickyWindowMs > 0 && sessionAgeMs > stickyWindowMs;

  if (!sessionExpired && !forceRotate) {
    console.log(
      `[gateway] reuse session=${currentSession.id} credential=${credential.username} provider=${currentSession.provider.slug} ageMs=${sessionAgeMs}`,
    );
    return currentSession;
  }

  const rotateReason = forceRotate ? "forceRotate (retry after failure)" : "sticky window expired";
  const selected = await selectRoute(credential.productId, credential.country ?? undefined);
  const route = selected
    ? await prisma.gatewayRoute.findUnique({
        where: { id: selected.routeId },
        include: { provider: true },
      })
    : null;
  // Fall back to the credential's existing provider/gateway if routing
  // currently has nothing available — better to retry the known provider
  // than fail the request outright.
  const targetProviderSlug = route?.provider.slug ?? currentSession.provider.slug;
  const targetProviderId = route?.providerId ?? currentSession.providerId;
  const targetGatewayId = route?.gatewayId ?? currentSession.gatewayId;

  if (targetProviderSlug !== currentSession.provider.slug) {
    console.log(
      `[gateway] FAILOVER credential=${credential.username} ${currentSession.provider.slug} -> ${targetProviderSlug} (reason: ${rotateReason})`,
    );
  } else {
    console.log(
      `[gateway] rotate session credential=${credential.username} provider=${targetProviderSlug} (reason: ${rotateReason})`,
    );
  }

  const adapter = getProviderAdapter(targetProviderSlug);
  const upstream = await adapter.createProxyCredential({
    productSlug: credential.product.slug,
    country: credential.country ?? undefined,
    region: credential.region ?? undefined,
    city: credential.city ?? undefined,
    protocol: credential.protocol,
    sessionType: credential.sessionType,
    sessionDurationMins: credential.sessionDurationMins ?? undefined,
  });

  const [, newSession] = await prisma.$transaction([
    prisma.proxySession.update({
      where: { id: currentSession.id },
      data: { endedAt: new Date() },
    }),
    prisma.proxySession.create({
      data: {
        credentialId: credential.id,
        gatewayId: targetGatewayId,
        providerId: targetProviderId,
        upstreamSessionRef: upstream.upstreamSessionRef,
        exitCountry: upstream.exitCountry,
        exitIp: upstream.exitIp,
      },
      include: { provider: true },
    }),
  ]);

  console.log(
    `[gateway] new session=${newSession.id} credential=${credential.username} provider=${targetProviderSlug} exitCountry=${upstream.exitCountry ?? "unknown"} exitIp=${upstream.exitIp ?? "unknown (not known synchronously for this provider)"}`,
  );

  return newSession;
}
