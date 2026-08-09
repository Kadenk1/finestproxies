import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/services/providers/registry";
import { logAdminAction, requestIp } from "@/lib/audit";
import { serializeBigInts } from "@/lib/serialize";

/**
 * Runs the adapter's real getGatewayHealth() check (for Bright Data and
 * IPRoyal, an actual request through the proxy — not just an API-key
 * check) and persists the result onto the Provider row, so the admin
 * dashboard's health cards reflect something real instead of whatever
 * was last seeded.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const providerRow = await prisma.provider.findUnique({ where: { id } });
  if (!providerRow) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  let result;
  try {
    const adapter = getProviderAdapter(providerRow.slug);
    result = await adapter.getGatewayHealth();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const provider = await prisma.provider.update({
    where: { id },
    data: {
      healthStatus: result.status,
      currentLatencyMs: result.latencyMs,
      successRatePercent: result.successRatePercent,
      lastHealthCheckAt: new Date(),
    },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "provider.tested",
    targetType: "Provider",
    targetId: provider.id,
    metadata: { slug: provider.slug, status: result.status, latencyMs: result.latencyMs },
    ipAddress: requestIp(request),
  });

  return NextResponse.json(serializeBigInts({ provider, result }));
}
