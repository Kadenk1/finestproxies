import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { siteRuleSchema } from "@/lib/validation/site-rule";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = siteRuleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const rule = await prisma.siteRule.update({
    where: { id },
    data: { ...parsed.data, label: parsed.data.label === "" ? null : parsed.data.label },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "site_rule.updated",
    targetType: "SiteRule",
    targetId: rule.id,
    metadata: parsed.data,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ rule });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.siteRule.delete({ where: { id } });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "site_rule.deleted",
    targetType: "SiteRule",
    targetId: id,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ message: "Site rule deleted." });
}
