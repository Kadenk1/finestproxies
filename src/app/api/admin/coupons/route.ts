import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { couponSchema } from "@/lib/validation/coupon";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "A coupon with that code already exists." }, { status: 400 });
  }

  const { expiresAt, ...data } = parsed.data;
  const coupon = await prisma.coupon.create({
    data: { ...data, expiresAt: expiresAt ? new Date(expiresAt) : null },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "coupon.created",
    targetType: "Coupon",
    targetId: coupon.id,
    metadata: { code: coupon.code },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ coupon }, { status: 201 });
}
