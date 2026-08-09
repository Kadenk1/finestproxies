import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { providerSchema } from "@/lib/validation/provider";
import { upsertProviderCredential } from "@/lib/db/provider-credentials";
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

  const { apiKey, extraCredentials, apiBaseUrl, notes, ...data } = parsed.data;

  const provider = await prisma.provider.update({
    where: { id },
    data: { ...data, apiBaseUrl: apiBaseUrl || null, notes: notes || null },
  });

  if (apiKey) {
    await upsertProviderCredential(id, "Primary API key", apiKey);
  }
  for (const cred of extraCredentials ?? []) {
    await upsertProviderCredential(id, cred.label, cred.value);
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
