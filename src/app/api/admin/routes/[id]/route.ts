import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { logAdminAction, requestIp } from "@/lib/audit";

const patchSchema = z.object({
  priority: z.coerce.number().int(),
  weight: z.coerce.number().int(),
  enabled: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const route = await prisma.gatewayRoute.update({ where: { id }, data: parsed.data });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "route.updated",
    targetType: "GatewayRoute",
    targetId: route.id,
    metadata: parsed.data,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ route });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.gatewayRoute.delete({ where: { id } });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "route.deleted",
    targetType: "GatewayRoute",
    targetId: id,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ message: "Route deleted." });
}
