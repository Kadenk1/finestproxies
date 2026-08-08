import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { gatewaySchema } from "@/lib/validation/gateway";
import { logAdminAction, requestIp } from "@/lib/audit";
import { serializeBigInts } from "@/lib/serialize";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = gatewaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await prisma.gateway.findUnique({ where: { hostname: parsed.data.hostname } });
  if (existing) {
    return NextResponse.json({ error: "A gateway with that hostname already exists." }, { status: 400 });
  }

  const { ipAddress, region, ...rest } = parsed.data;
  const gateway = await prisma.gateway.create({
    data: { ...rest, ipAddress: ipAddress || null, region: region || null },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "gateway.created",
    targetType: "Gateway",
    targetId: gateway.id,
    metadata: { hostname: gateway.hostname },
    ipAddress: requestIp(request),
  });

  return NextResponse.json(serializeBigInts({ gateway }), { status: 201 });
}
