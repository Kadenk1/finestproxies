import { Database, Gauge, CalendarRange } from "lucide-react";
import { auth } from "@/auth";
import { getDashboardOverview } from "@/lib/data/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BandwidthAreaChart } from "@/components/dashboard/charts/bandwidth-area-chart";
import { RequestsBarChart } from "@/components/dashboard/charts/requests-bar-chart";
import { ProductUsageChart } from "@/components/dashboard/charts/product-usage-chart";
import { LinkButton } from "@/components/ui/link-button";
import { bytesToGb } from "@/services/usage/usage-service";

const orderStatusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  PAID: "default",
  PENDING: "secondary",
  FAILED: "destructive",
  REFUNDED: "secondary",
  CANCELLED: "destructive",
};

export default async function DashboardOverviewPage() {
  const session = await auth();
  const userId = session!.user.id;
  const data = await getDashboardOverview(userId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your account.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.productBalances.length === 0 ? (
          <StatCard label="Balance" value="No balance yet" icon={Database} />
        ) : (
          data.productBalances.map((b) => (
            <StatCard
              key={b.id}
              label={`${b.product.name} remaining`}
              value={
                b.product.billingUnit === "GB"
                  ? `${bytesToGb(b.remainingBytes).toFixed(2)} GB`
                  : `${Number(b.remainingUnits).toFixed(0)} ${b.product.billingUnit === "IP_MONTH" ? "IPs" : "units"}`
              }
              hint={
                b.product.billingUnit === "GB"
                  ? `of ${bytesToGb(b.allocatedBytes).toFixed(0)} GB purchased`
                  : `of ${Number(b.allocatedUnits).toFixed(0)} allocated`
              }
              icon={Database}
            />
          ))
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Bandwidth used today"
          value={`${data.bandwidthTodayGb.toFixed(2)} GB`}
          icon={Gauge}
        />
        <StatCard
          label="Bandwidth used this month"
          value={`${data.bandwidthThisMonthGb.toFixed(2)} GB`}
          icon={CalendarRange}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily bandwidth (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <BandwidthAreaChart data={data.dailyBandwidth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Requests (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <RequestsBarChart data={data.dailyRequests} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage by product</CardTitle>
          </CardHeader>
          <CardContent>
            {data.productUsage.length > 0 ? (
              <ProductUsageChart data={data.productUsage} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No usage recorded yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent purchases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-foreground">
                    {order.items.map((i) => i.product.name).join(", ") || "Order"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    ${Number(order.total).toFixed(2)}
                  </span>
                  <Badge variant={orderStatusVariant[order.status] ?? "secondary"}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
            <LinkButton href="/dashboard/orders" variant="ghost" size="sm" className="w-full">
              View all orders
            </LinkButton>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentUsage.length === 0 && (
            <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
          )}
          {data.recentUsage.map((record) => (
            <div key={record.id} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium text-foreground">{record.product.name}</div>
                <div className="text-xs text-muted-foreground">
                  {record.occurredAt.toLocaleString()} · {record.requestCount} requests
                </div>
              </div>
              <span className="font-medium text-foreground">
                {bytesToGb(record.totalBytes).toFixed(3)} GB
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
