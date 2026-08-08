import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { updateCustomerStatusSchema } from "@/lib/validation/admin";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateCustomerStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const customer = await prisma.user.findUnique({ where: { id } });
  if (!customer || customer.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { status: parsed.data.status } });

  if (parsed.data.status !== "ACTIVE") {
    await prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.customerProxyCredential.updateMany({
      where: { userId: id, status: "ACTIVE" },
      data: { status: "DISABLED", revokedAt: new Date(), revokedReason: "Account " + parsed.data.status.toLowerCase() },
    });
  }

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "customer.status_changed",
    targetType: "User",
    targetId: id,
    metadata: { status: parsed.data.status, reason: parsed.data.reason },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ message: "Customer status updated." });
}
