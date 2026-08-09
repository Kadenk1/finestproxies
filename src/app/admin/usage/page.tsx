import { prisma } from "@/lib/db/prisma";
import { bytesToGb } from "@/services/usage/usage-service";
import { StatCard } from "@/components/dashboard/stat-card";
import { Database, Gauge } from "lucide-react";
import { ProductUsageChart } from "@/components/dashboard/charts/product-usage-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminUsagePage() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayAgg, monthAgg, byProduct, recent] = await Promise.all([
    prisma.usageRecord.aggregate({
      where: { occurredAt: { gte: todayStart } },
      _sum: { totalBytes: true },
    }),
    prisma.usageRecord.aggregate({
      where: { occurredAt: { gte: monthStart } },
      _sum: { totalBytes: true },
    }),
    prisma.usageRecord.groupBy({
      by: ["productId"],
      _sum: { totalBytes: true },
      where: { occurredAt: { gte: monthStart } },
    }),
    prisma.usageRecord.findMany({
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: { user: true, product: true, gateway: true },
    }),
  ]);

  const products = await prisma.product.findMany({
    where: { id: { in: byProduct.map((b) => b.productId) } },
  });
  const productUsage = byProduct.map((b) => ({
    name: products.find((p) => p.id === b.productId)?.name ?? "Unknown",
    gb: bytesToGb(b._sum.totalBytes ?? 0n),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide bandwidth accounting across all customers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Bandwidth today"
          value={`${bytesToGb(todayAgg._sum.totalBytes ?? 0n).toFixed(2)} GB`}
          icon={Gauge}
        />
        <StatCard
          label="Bandwidth this month"
          value={`${bytesToGb(monthAgg._sum.totalBytes ?? 0n).toFixed(2)} GB`}
          icon={Database}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage by product (this month)</CardTitle>
        </CardHeader>
        <CardContent>
          {productUsage.length > 0 ? (
            <ProductUsageChart data={productUsage} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No usage yet.</p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Recent usage events</h2>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.user.email}</TableCell>
                  <TableCell>{r.product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.gateway.name}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {bytesToGb(r.totalBytes).toFixed(3)} GB
                  </TableCell>
                  <TableCell>{r.requestCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.occurredAt.toLocaleString()}
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
