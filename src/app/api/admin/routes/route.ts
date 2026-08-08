import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { gatewayRouteSchema } from "@/lib/validation/route";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = gatewayRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const route = await prisma.gatewayRoute.upsert({
    where: {
      gatewayId_providerId_productId: {
        gatewayId: parsed.data.gatewayId,
        providerId: parsed.data.providerId,
        productId: parsed.data.productId,
      },
    },
    update: parsed.data,
    create: parsed.data,
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "route.created_or_updated",
    targetType: "GatewayRoute",
    targetId: route.id,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ route }, { status: 201 });
}
