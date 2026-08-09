import { auth } from "@/auth";
import { getGeneratorCatalog } from "@/lib/data/catalog";
import { prisma } from "@/lib/db/prisma";
import { ProxyGeneratorForm } from "@/components/dashboard/proxy-generator-form";

export default async function ProxyGeneratorPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [products, balances] = await Promise.all([
    getGeneratorCatalog(),
    prisma.productBalance.findMany({ where: { userId } }),
  ]);

  const balanceByProduct = new Map(balances.map((b) => [b.productId, b]));

  const catalog = products.map((p) => {
    const balance = balanceByProduct.get(p.id);
    const hasBalance = balance
      ? balance.remainingBytes > 0n || Number(balance.remainingUnits) > 0
      : false;
    return {
      slug: p.slug,
      name: p.name,
      hasBalance,
      locations: p.locations.map((l) => ({ country: l.country })),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Proxy Generator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate credentials scoped to our gateways — never upstream
          provider credentials.
        </p>
      </div>
      <ProxyGeneratorForm products={catalog} />
    </div>
  );
}
