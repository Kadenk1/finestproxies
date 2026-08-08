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
  SUCCEEDED: "default",
  PENDING: "secondary",
  FAILED: "destructive",
  REFUNDED: "secondary",
};

export default async function AdminPaymentsPage() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { order: { include: { user: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Most recent 100 payments. All payments in development run through the mock provider.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {payment.id.slice(0, 8)}
                </TableCell>
                <TableCell>{payment.order.user.email}</TableCell>
                <TableCell>{payment.provider}</TableCell>
                <TableCell className="font-medium text-navy-900">
                  ${Number(payment.amount).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[payment.status] ?? "secondary"}>
                    {payment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {payment.createdAt.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
