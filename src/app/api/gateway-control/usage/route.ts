import { NextResponse } from "next/server";
import { isAuthorizedGatewayAgent } from "@/lib/auth/require-gateway-agent";
import { usageIngestSchema } from "@/lib/validation/gateway-control";
import { prisma } from "@/lib/db/prisma";
import { recordUsageEvent } from "@/services/usage/usage-service";

/**
 * Gateway Control API: usage ingestion. This is the production path that
 * `POST /api/dashboard/usage/simulate` stands in for in development —
 * `recordUsageEvent`'s dedupe-by-key guarantee is what makes it safe for a
 * gateway agent to retry a delivery without double-charging a customer.
 */
export async function POST(request: Request) {
  if (!isAuthorizedGatewayAgent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = usageIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const gateway = await prisma.gateway.findUnique({ where: { hostname: data.gatewayHostname } });
  if (!gateway) {
    return NextResponse.json({ error: "Unknown gateway hostname" }, { status: 404 });
  }

  const credential = await prisma.customerProxyCredential.findUnique({
    where: { username: data.credentialUsername },
    include: { sessions: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (!credential) {
    return NextResponse.json({ error: "Unknown credential username" }, { status: 404 });
  }

  const providerId = credential.sessions[0]?.providerId;
  if (!providerId) {
    return NextResponse.json(
      { error: "Credential has no session to attribute usage to" },
      { status: 400 },
    );
  }

  const record = await recordUsageEvent({
    userId: credential.userId,
    productId: credential.productId,
    gatewayId: gateway.id,
    providerId,
    credentialId: credential.id,
    bytesUploaded: data.bytesUploaded,
    bytesDownloaded: data.bytesDownloaded,
    requestCount: data.requestCount,
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined,
    dedupeKey: data.dedupeKey,
  });

  return NextResponse.json({
    id: record.id,
    totalBytes: record.totalBytes.toString(),
  });
}
