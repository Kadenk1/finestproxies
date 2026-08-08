import { prisma } from "@/lib/db/prisma";

export async function getGeneratorCatalog() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { locations: { where: { available: true }, orderBy: { country: "asc" } } },
  });
  return products;
}
