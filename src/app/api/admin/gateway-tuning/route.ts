import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { gatewayTuningSchema } from "@/lib/validation/gateway-tuning";
import { GATEWAY_TUNING_SETTING_KEYS } from "@/lib/config/gateway-tuning";
import { logAdminAction, requestIp } from "@/lib/audit";

const SETTING_KEY_BY_FIELD = {
  qualityCheckEnabled: GATEWAY_TUNING_SETTING_KEYS[0],
  qualityCheckOnRotation: GATEWAY_TUNING_SETTING_KEYS[1],
  issuanceQualityCheckMaxAttempts: GATEWAY_TUNING_SETTING_KEYS[2],
  rotationQualityCheckMaxAttempts: GATEWAY_TUNING_SETTING_KEYS[3],
  defaultStickyWindowMins: GATEWAY_TUNING_SETTING_KEYS[4],
} as const;

/**
 * Upserts every gateway-tuning field as one SystemSetting row each, in a
 * single transaction — these five values are one coherent config object
 * from the admin's point of view (see the "Gateway tuning" section on
 * /admin/settings), so a save either applies all of them or none.
 *
 * getGatewayTuning() caches reads for 30s, so a save here can take up to
 * that long to be reflected in a live gateway resolve — acceptable for a
 * tuning knob, not for anything that needs to react instantly.
 */
export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = gatewayTuningSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const entries = Object.entries(parsed.data) as [keyof typeof SETTING_KEY_BY_FIELD, boolean | number][];

  await prisma.$transaction(
    entries.map(([field, value]) =>
      prisma.systemSetting.upsert({
        where: { key: SETTING_KEY_BY_FIELD[field] },
        update: { value },
        create: { key: SETTING_KEY_BY_FIELD[field], value },
      }),
    ),
  );

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "gateway_tuning.updated",
    targetType: "SystemSetting",
    metadata: parsed.data,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ ok: true });
}
