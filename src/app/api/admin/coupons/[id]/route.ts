import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { couponSchema } from "@/lib/validation/coupon";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const conflict = await prisma.coupon.findFirst({ where: { code: parsed.data.code, NOT: { id } } });
  if (conflict) {
    return NextResponse.json({ error: "A coupon with that code already exists." }, { status: 400 });
  }

  const { expiresAt, ...data } = parsed.data;
  const coupon = await prisma.coupon.update({
    where: { id },
    data: { ...data, expiresAt: expiresAt ? new Date(expiresAt) : null },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "coupon.updated",
    targetType: "Coupon",
    targetId: coupon.id,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ coupon });
}
