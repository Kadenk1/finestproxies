import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { systemSettingSchema } from "@/lib/validation/system-setting";
import { logAdminAction, requestIp } from "@/lib/audit";

function parseValue(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = systemSettingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const setting = await prisma.systemSetting.upsert({
    where: { key: parsed.data.key },
    update: { value: parseValue(parsed.data.value), description: parsed.data.description || null },
    create: {
      key: parsed.data.key,
      value: parseValue(parsed.data.value),
      description: parsed.data.description || null,
    },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "system_setting.upserted",
    targetType: "SystemSetting",
    targetId: setting.id,
    metadata: { key: setting.key },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ setting }, { status: 201 });
}
