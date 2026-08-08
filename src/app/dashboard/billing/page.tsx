import { auth } from "@/auth";
import { getCustomerBalanceSummary } from "@/services/billing/order-service";
import { prisma } from "@/lib/db/prisma";
import { bytesToGb } from "@/services/usage/usage-service";
import { StatCard } from "@/components/dashboard/stat-card";
import { Wallet } from "lucide-react";
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

export default async function BillingPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [{ cashBalance, productBalances }, payments] = await Promise.all([
    getCustomerBalanceSummary(userId),
    prisma.payment.findMany({
      where: { order: { userId } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { order: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account credit, product balances, and payment history.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Account credit"
          value={`$${Number(cashBalance?.cashBalance ?? 0).toFixed(2)}`}
          icon={Wallet}
        />
        {productBalances.map((b) => (
          <StatCard
            key={b.id}
            label={`${b.product.name} balance`}
            value={
              b.product.billingUnit === "GB"
                ? `${bytesToGb(b.remainingBytes).toFixed(2)} GB`
                : `${Number(b.remainingUnits).toFixed(0)} ${b.product.billingUnit === "IP_MONTH" ? "IPs" : "units"}`
            }
          />
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Payment history</h2>
        {payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-white p-10 text-center text-sm text-muted-foreground">
            No payments yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{p.provider}</TableCell>
                    <TableCell className="font-medium text-navy-900">
                      ${Number(p.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status] ?? "secondary"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.createdAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Payments are processed through a mock provider in development. Real
        payment processing (Stripe) is wired up in a later phase.
      </p>
    </div>
  );
}
