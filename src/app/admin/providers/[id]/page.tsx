import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Gauge, Percent, DollarSign, Database } from "lucide-react";
import { ProviderCostConfig } from "@/components/admin/provider-cost-config";
import { ProviderLocationsForm } from "@/components/admin/provider-locations-form";
import { bytesToGb } from "@/services/usage/usage-service";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  HEALTHY: "default",
  DEGRADED: "secondary",
  OFFLINE: "destructive",
  MAINTENANCE: "secondary",
};

export default async function AdminProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [provider, products, providerProducts, locations, credentials] = await Promise.all([
    prisma.provider.findUnique({ where: { id } }),
    prisma.product.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.providerProduct.findMany({ where: { providerId: id } }),
    prisma.providerLocation.findMany({ where: { providerId: id } }),
    prisma.providerCredential.findMany({ where: { providerId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!provider) notFound();

  const costRows = products.map((p) => {
    const pp = providerProducts.find((x) => x.productId === p.id);
    return {
      productId: p.id,
      productName: p.name,
      billingUnit: p.billingUnit,
      costPerGb: pp?.costPerGb ? Number(pp.costPerGb) : null,
      costPerIp: pp?.costPerIp ? Number(pp.costPerIp) : null,
      costPerPort: pp?.costPerPort ? Number(pp.costPerPort) : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{provider.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{provider.slug}</p>
        </div>
        <Badge variant={statusVariant[provider.healthStatus] ?? "secondary"}>
          {provider.healthStatus}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Latency" value={`${provider.currentLatencyMs ?? "—"}ms`} icon={Gauge} />
        <StatCard
          label="Success rate"
          value={provider.successRatePercent ? `${Number(provider.successRatePercent)}%` : "—"}
          icon={Percent}
        />
        <StatCard
          label="Monthly usage"
          value={`${bytesToGb(provider.monthlyUsageBytes).toFixed(1)} GB`}
          icon={Database}
        />
        <StatCard
          label="Monthly cost"
          value={`$${Number(provider.monthlyCost).toFixed(2)}`}
          icon={DollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <ProviderCostConfig providerId={provider.id} rows={costRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <ProviderLocationsForm
            providerId={provider.id}
            defaultValue={locations.map((l) => l.country).join(", ")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credential history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {credentials.length === 0 && (
            <p className="text-sm text-muted-foreground">No credentials configured.</p>
          )}
          {credentials.map((cred) => (
            <div key={cred.id} className="flex items-center justify-between text-sm">
              <span className="text-navy-900">
                {cred.label} <span className="text-muted-foreground">({cred.type})</span>
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Added {cred.createdAt.toLocaleDateString()}</span>
                <Badge variant={cred.active ? "default" : "secondary"}>
                  {cred.active ? "Active" : "Rotated out"}
                </Badge>
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            Secret values are encrypted at rest and never displayed after saving. Edit the
            provider to rotate the key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
