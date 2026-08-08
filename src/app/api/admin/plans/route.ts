import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { planSchema } from "@/lib/validation/plan";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existingSlug = await prisma.plan.findUnique({ where: { slug: parsed.data.slug } });
  if (existingSlug) {
    return NextResponse.json({ error: "A plan with that slug already exists." }, { status: 400 });
  }

  const plan = await prisma.plan.create({ data: parsed.data });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "plan.created",
    targetType: "Plan",
    targetId: plan.id,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ plan }, { status: 201 });
}
