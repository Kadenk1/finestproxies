import Link from "next/link";
import { Users, DollarSign, Activity, LifeBuoy } from "lucide-react";
import { getAdminOverview, getRevenueByProduct } from "@/lib/data/admin";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductUsageChart } from "@/components/dashboard/charts/product-usage-chart";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  HEALTHY: "default",
  DEGRADED: "secondary",
  OFFLINE: "destructive",
  MAINTENANCE: "secondary",
  PAID: "default",
  PENDING: "secondary",
  FAILED: "destructive",
};

export default async function AdminOverviewPage() {
  const data = await getAdminOverview();
  const revenueByProduct = await getRevenueByProduct();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide KPIs across customers, revenue, and infrastructure.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/customers" className="block rounded-2xl transition-shadow hover:shadow-md">
          <StatCard
            label="Customers"
            value={data.customerCount.toString()}
            hint={`${data.activeCustomerCount} active — manage →`}
            icon={Users}
          />
        </Link>
        <StatCard
          label="Total revenue"
          value={`$${data.totalRevenue.toFixed(2)}`}
          hint="Succeeded payments"
          icon={DollarSign}
        />
        <StatCard
          label="Total bandwidth served"
          value={`${data.totalUsageGb.toFixed(1)} GB`}
          icon={Activity}
        />
        <Link href="/admin/support" className="block rounded-2xl transition-shadow hover:shadow-md">
          <StatCard
            label="Open support tickets"
            value={data.openTickets.toString()}
            hint="manage →"
            icon={LifeBuoy}
          />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gateway health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.gatewayStatusCounts.map((row) => (
              <div key={row.status} className="flex items-center justify-between text-sm">
                <Badge variant={statusVariant[row.status] ?? "secondary"}>{row.status}</Badge>
                <span className="font-medium text-foreground">{row._count._all}</span>
              </div>
            ))}
            <Link href="/admin/gateways" className="mt-2 block text-xs text-brand-700 hover:underline">
              Manage gateways →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.providerStatusCounts.map((row) => (
              <div key={row.healthStatus} className="flex items-center justify-between text-sm">
                <Badge variant={statusVariant[row.healthStatus] ?? "secondary"}>
                  {row.healthStatus}
                </Badge>
                <span className="font-medium text-foreground">{row._count._all}</span>
              </div>
            ))}
            <Link href="/admin/providers" className="mt-2 block text-xs text-brand-700 hover:underline">
              Manage providers →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by product</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByProduct.length > 0 ? (
              <ProductUsageChart data={revenueByProduct.map((r) => ({ name: r.name, gb: r.revenue }))} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No revenue yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm">
                <div>
                  <Link
                    href={`/admin/customers/${order.user.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {order.user.email}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {order.items.map((i) => i.product.name).join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">${Number(order.total).toFixed(2)}</span>
                  <Badge variant={statusVariant[order.status] ?? "secondary"}>{order.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent signups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentSignups.length === 0 && (
            <p className="text-sm text-muted-foreground">No customers yet.</p>
          )}
          {data.recentSignups.map((user) => (
            <Link
              key={user.id}
              href={`/admin/customers/${user.id}`}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
            >
              <span className="text-brand-700">{user.email}</span>
              <span className="text-xs text-muted-foreground">
                {user.createdAt.toLocaleDateString()}
              </span>
            </Link>
          ))}
          <Link href="/admin/customers" className="mt-2 block text-xs text-brand-700 hover:underline">
            View all customers →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
