import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const setting = await prisma.systemSetting.delete({ where: { id } });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "system_setting.deleted",
    targetType: "SystemSetting",
    targetId: id,
    metadata: { key: setting.key },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ message: "Setting deleted." });
}
