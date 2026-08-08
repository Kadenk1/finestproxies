import { prisma } from "@/lib/db/prisma";

/** Parses a comma-separated country code list and replaces a product's ProductLocation rows with it. */
export async function syncProductLocations(productId: string, raw: string | undefined) {
  const countries = (raw ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  await prisma.$transaction([
    prisma.productLocation.deleteMany({ where: { productId } }),
    ...(countries.length
      ? [
          prisma.productLocation.createMany({
            data: countries.map((country) => ({ productId, country })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}
