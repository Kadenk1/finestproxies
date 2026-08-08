import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { planSchema } from "@/lib/validation/plan";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const conflictingSlug = await prisma.plan.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (conflictingSlug) {
    return NextResponse.json({ error: "A plan with that slug already exists." }, { status: 400 });
  }

  const plan = await prisma.plan.update({ where: { id }, data: parsed.data });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "plan.updated",
    targetType: "Plan",
    targetId: plan.id,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ plan });
}
