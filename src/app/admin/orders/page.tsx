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

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  PAID: "default",
  PENDING: "secondary",
  FAILED: "destructive",
  REFUNDED: "secondary",
  CANCELLED: "destructive",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, items: { include: { product: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Most recent 100 orders across all customers.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
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
                <TableCell>{order.user.email}</TableCell>
                <TableCell>
                  {order.items.map((i) => `${i.product.name} × ${Number(i.quantity)}`).join(", ")}
                </TableCell>
                <TableCell className="font-medium text-navy-900">
                  ${Number(order.total).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[order.status] ?? "secondary"}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {order.createdAt.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
