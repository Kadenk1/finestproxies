import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { siteRuleSchema } from "@/lib/validation/site-rule";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = siteRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await prisma.siteRule.findUnique({ where: { pattern: parsed.data.pattern } });
  if (existing) {
    return NextResponse.json({ error: "A rule for this pattern already exists." }, { status: 409 });
  }

  const rule = await prisma.siteRule.create({
    data: { ...parsed.data, label: parsed.data.label || null },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "site_rule.created",
    targetType: "SiteRule",
    targetId: rule.id,
    metadata: { pattern: rule.pattern },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ rule }, { status: 201 });
}
