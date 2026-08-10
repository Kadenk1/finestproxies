import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isAuthorizedGatewayAgent } from "@/lib/auth/require-gateway-agent";
import { resolveCredentialSchema } from "@/lib/validation/gateway-control";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getProviderAdapter } from "@/services/providers/registry";
import { resolveActiveUpstreamSession } from "@/services/gateway/gateway-service";
import { getSiteRoutingProfile } from "@/lib/config/gateway-tuning";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Gateway Control API: credential resolution. A gateway agent calls this
 * once per new client connection (with a short local cache — this must
 * stay cheap) to turn the customer's proxy username/password into an
 * actual upstream endpoint to dial. This is the only place the literal
 * upstream host/port/credentials ever leave the app process — the agent
 * itself never touches the database or SECRETS_ENCRYPTION_KEY.
 */
export async function POST(request: Request) {
  if (!isAuthorizedGatewayAgent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resolveCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const credential = await prisma.customerProxyCredential.findUnique({
    where: { username: parsed.data.username },
    include: { gateway: true },
  });
  if (!credential) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!safeEqual(decryptSecret(credential.passwordEnc), parsed.data.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (credential.status !== "ACTIVE") {
    return NextResponse.json({ error: "Credential is not active" }, { status: 403 });
  }

  try {
    // Transparently mints a fresh upstream session (new exit IP) if this is
    // STICKY and the current one has outlived sessionDurationMins — the
    // credential itself has no expiry tied to that window.
    const session = await resolveActiveUpstreamSession(
      credential.id,
      parsed.data.forceRotate,
      parsed.data.targetHost,
    );
    if (!session.upstreamSessionRef) {
      return NextResponse.json({ error: "No active session for this credential" }, { status: 404 });
    }

    const adapter = getProviderAdapter(session.provider.slug);
    const upstream = await adapter.getUpstreamConnection(session.upstreamSessionRef);

    await prisma.customerProxyCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });

    // Per-destination connection timeout override, if the matched SiteRule
    // (if any) sets one — gateway-agent has no DB access, so this is the
    // only place it can learn about a per-site timeout preference.
    const routingProfile = parsed.data.targetHost
      ? await getSiteRoutingProfile(parsed.data.targetHost)
      : null;

    return NextResponse.json({
      upstream,
      credentialUsername: credential.username,
      gatewayHostname: credential.gateway.hostname,
      sessionId: session.id,
      exitCountry: session.exitCountry,
      // Lets the agent tag its connection-stats reports with which pool
      // actually served the connection, without the agent needing any DB
      // access itself — see connection-stats/route.ts.
      providerSlug: session.provider.slug,
      connectionTimeoutMs: routingProfile?.connectionTimeoutMs ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve upstream connection.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
