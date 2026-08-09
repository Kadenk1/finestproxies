import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getOrderHistory } from "@/services/billing/order-service";
import { BuyProductForm } from "@/components/dashboard/buy-product-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  PAID: "default",
  PENDING: "secondary",
  FAILED: "destructive",
  REFUNDED: "secondary",
  CANCELLED: "destructive",
};

export default async function OrdersPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [orders, products] = await Promise.all([
    getOrderHistory(userId),
    prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const buyable = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    retailPrice: Number(p.retailPrice),
    billingUnit: p.billingUnit,
    minPurchase: Number(p.minPurchase),
    maxPurchase: Number(p.maxPurchase),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buy bandwidth or IP allocations and review your order history.
        </p>
      </div>

      <BuyProductForm products={buyable} />

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
          No orders yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {order.items
                      .map((i) => `${i.product.name} × ${Number(i.quantity)}`)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    ${Number(order.total).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[order.status] ?? "secondary"}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {order.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
