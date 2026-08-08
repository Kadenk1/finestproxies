import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { providerSchema } from "@/lib/validation/provider";
import { encryptSecret } from "@/lib/crypto/secrets";
import { logAdminAction, requestIp } from "@/lib/audit";
import { serializeBigInts } from "@/lib/serialize";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = providerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const conflictingSlug = await prisma.provider.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (conflictingSlug) {
    return NextResponse.json({ error: "A provider with that slug already exists." }, { status: 400 });
  }

  const { apiKey, apiBaseUrl, notes, ...data } = parsed.data;

  const provider = await prisma.provider.update({
    where: { id },
    data: { ...data, apiBaseUrl: apiBaseUrl || null, notes: notes || null },
  });

  if (apiKey) {
    await prisma.providerCredential.updateMany({
      where: { providerId: id, type: "API_KEY", active: true },
      data: { active: false, rotatedAt: new Date() },
    });
    await prisma.providerCredential.create({
      data: {
        providerId: id,
        type: "API_KEY",
        label: "Primary API key",
        encryptedValue: encryptSecret(apiKey),
      },
    });
  }

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "provider.updated",
    targetType: "Provider",
    targetId: provider.id,
    metadata: { slug: provider.slug, enabled: provider.enabled, secretRotated: Boolean(apiKey) },
    ipAddress: requestIp(request),
  });

  return NextResponse.json(serializeBigInts({ provider }));
}
