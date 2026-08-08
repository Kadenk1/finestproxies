import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { productSchema } from "@/lib/validation/product";
import { syncProductLocations } from "@/lib/data/product-locations";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { locations, ...data } = parsed.data;

  const existingSlug = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existingSlug) {
    return NextResponse.json({ error: "A product with that slug already exists." }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: { ...data, description: data.description || null },
  });
  await syncProductLocations(product.id, locations);

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "product.created",
    targetType: "Product",
    targetId: product.id,
    metadata: { slug: product.slug },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ product }, { status: 201 });
}
