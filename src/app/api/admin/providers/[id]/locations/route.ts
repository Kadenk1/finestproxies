import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { providerLocationsSchema } from "@/lib/validation/provider";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = providerLocationsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const countries = (parsed.data.locations ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  await prisma.$transaction([
    prisma.providerLocation.deleteMany({ where: { providerId: id } }),
    ...(countries.length
      ? [
          prisma.providerLocation.createMany({
            data: countries.map((country) => ({ providerId: id, country })),
          }),
        ]
      : []),
  ]);

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "provider.locations_updated",
    targetType: "Provider",
    targetId: id,
    metadata: { countries },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ message: "Locations updated." });
}
