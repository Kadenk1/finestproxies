import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { productSchema } from "@/lib/validation/product";
import { syncProductLocations } from "@/lib/data/product-locations";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { locations, ...data } = parsed.data;

  const conflictingSlug = await prisma.product.findFirst({
    where: { slug: data.slug, NOT: { id } },
  });
  if (conflictingSlug) {
    return NextResponse.json({ error: "A product with that slug already exists." }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: { ...data, description: data.description || null },
  });
  await syncProductLocations(product.id, locations);

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "product.updated",
    targetType: "Product",
    targetId: product.id,
    metadata: { slug: product.slug, active: product.active },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ product });
}
