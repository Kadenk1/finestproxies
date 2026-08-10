import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isAuthorizedGatewayAgent } from "@/lib/auth/require-gateway-agent";
import { resolveCredentialSchema } from "@/lib/validation/gateway-control";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getProviderAdapter } from "@/services/providers/registry";
import { resolveActiveUpstreamSession } from "@/services/gateway/gateway-service";

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

    return NextResponse.json({
      upstream,
      credentialUsername: credential.username,
      gatewayHostname: credential.gateway.hostname,
      sessionId: session.id,
      exitCountry: session.exitCountry,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve upstream connection.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
