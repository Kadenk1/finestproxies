import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { providerProductSchema } from "@/lib/validation/provider";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = providerProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const providerProduct = await prisma.providerProduct.upsert({
    where: { providerId_productId: { providerId: id, productId: parsed.data.productId } },
    update: parsed.data,
    create: { providerId: id, ...parsed.data },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "provider.cost_config_updated",
    targetType: "Provider",
    targetId: id,
    metadata: { productId: parsed.data.productId },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ providerProduct });
}
