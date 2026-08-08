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
import { ProductFormDialog } from "@/components/admin/product-form-dialog";

const billingUnitLabel: Record<string, string> = {
  GB: "GB",
  IP_MONTH: "IP/mo",
  PORT_MONTH: "Port/mo",
  FLAT: "Flat",
};

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { sortOrder: "asc" },
    include: { locations: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage products without touching code.
          </p>
        </div>
        <ProductFormDialog />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Retail</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead>Locations</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const retail = Number(product.retailPrice);
              const cost = Number(product.internalCostEstimate);
              const margin = retail > 0 ? ((retail - cost) / retail) * 100 : 0;
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="font-medium text-navy-900">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.slug}</div>
                  </TableCell>
                  <TableCell>{product.type}</TableCell>
                  <TableCell>
                    ${retail.toFixed(2)}/{billingUnitLabel[product.billingUnit]}
                  </TableCell>
                  <TableCell>${cost.toFixed(2)}</TableCell>
                  <TableCell>{margin.toFixed(1)}%</TableCell>
                  <TableCell>{product.locations.length}</TableCell>
                  <TableCell>
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ProductFormDialog
                      product={{
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        type: product.type,
                        description: product.description,
                        active: product.active,
                        billingUnit: product.billingUnit,
                        retailPrice: retail,
                        internalCostEstimate: cost,
                        minPurchase: Number(product.minPurchase),
                        maxPurchase: Number(product.maxPurchase),
                        sortOrder: product.sortOrder,
                        locations: product.locations.map((l) => l.country),
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
