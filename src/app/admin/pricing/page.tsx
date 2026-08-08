import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanFormDialog } from "@/components/admin/plan-form-dialog";

export default async function AdminPricingPage() {
  const [products, plans] = await Promise.all([
    prisma.product.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.plan.findMany({ orderBy: { createdAt: "desc" }, include: { product: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Base pricing lives on each product; recurring plans are managed here.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Base pricing by product</h2>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Retail</TableHead>
                <TableHead>Internal cost</TableHead>
                <TableHead>Gross margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const retail = Number(p.retailPrice);
                const cost = Number(p.internalCostEstimate);
                const margin = retail > 0 ? ((retail - cost) / retail) * 100 : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-navy-900">{p.name}</TableCell>
                    <TableCell>${retail.toFixed(4)}/{p.billingUnit}</TableCell>
                    <TableCell>${cost.toFixed(4)}</TableCell>
                    <TableCell>{margin.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Edit base pricing from the Products page.
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Recurring plans</h2>
          <PlanFormDialog products={products.map((p) => ({ id: p.id, name: p.name }))} />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Allowance</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium text-navy-900">{plan.name}</TableCell>
                  <TableCell>{plan.product.name}</TableCell>
                  <TableCell>{plan.billingInterval}</TableCell>
                  <TableCell>${Number(plan.price).toFixed(2)}</TableCell>
                  <TableCell>{Number(plan.unitAllowance)}</TableCell>
                  <TableCell>
                    <Badge variant={plan.active ? "default" : "secondary"}>
                      {plan.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <PlanFormDialog
                      products={products.map((p) => ({ id: p.id, name: p.name }))}
                      plan={{
                        id: plan.id,
                        productId: plan.productId,
                        name: plan.name,
                        slug: plan.slug,
                        billingInterval: plan.billingInterval,
                        price: Number(plan.price),
                        unitAllowance: Number(plan.unitAllowance),
                        active: plan.active,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
