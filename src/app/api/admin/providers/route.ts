import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { providerSchema } from "@/lib/validation/provider";
import { encryptSecret } from "@/lib/crypto/secrets";
import { logAdminAction, requestIp } from "@/lib/audit";
import { serializeBigInts } from "@/lib/serialize";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = providerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existingSlug = await prisma.provider.findUnique({ where: { slug: parsed.data.slug } });
  if (existingSlug) {
    return NextResponse.json({ error: "A provider with that slug already exists." }, { status: 400 });
  }

  const { apiKey, apiBaseUrl, notes, ...data } = parsed.data;

  const provider = await prisma.provider.create({
    data: {
      ...data,
      apiBaseUrl: apiBaseUrl || null,
      notes: notes || null,
      ...(apiKey
        ? {
            credentials: {
              create: [{ type: "API_KEY", label: "Primary API key", encryptedValue: encryptSecret(apiKey) }],
            },
          }
        : {}),
    },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "provider.created",
    targetType: "Provider",
    targetId: provider.id,
    metadata: { slug: provider.slug },
    ipAddress: requestIp(request),
  });

  return NextResponse.json(serializeBigInts({ provider }), { status: 201 });
}
