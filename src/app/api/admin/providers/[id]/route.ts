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

/**
 * Hard-deletes a Provider and its config (credentials, cost rows,
 * locations, gateway routes — all onDelete: Cascade). ProxySession and
 * UsageRecord are onDelete: Restrict, deliberately — deleting a provider
 * config must never silently wipe real session/usage history, so a
 * provider that has ever actually served traffic can't be deleted this
 * way at all; disable it (PATCH enabled: false) instead. The 409 here
 * surfaces that distinction instead of letting Postgres's raw FK error
 * leak to the client.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const provider = await prisma.provider.findUnique({ where: { id } });
  if (!provider) {
    return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  }

  try {
    await prisma.provider.delete({ where: { id } });
  } catch (err) {
    // Prisma P2003 = foreign key constraint failed, i.e. ProxySession or
    // UsageRecord rows still reference this provider.
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2003") {
      return NextResponse.json(
        {
          error:
            "This provider has session/usage history and can't be deleted — disable it instead (edit the provider, uncheck Enabled).",
        },
        { status: 409 },
      );
    }
    throw err;
  }

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "provider.deleted",
    targetType: "Provider",
    targetId: id,
    metadata: { slug: provider.slug },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ message: "Provider deleted." });
}
