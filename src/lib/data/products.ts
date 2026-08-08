import { prisma } from "@/lib/db/prisma";

export function getActiveProductsWithPlans() {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      plans: { where: { active: true }, orderBy: { price: "asc" } },
      locations: { where: { available: true } },
    },
  });
}
