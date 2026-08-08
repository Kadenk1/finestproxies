import Link from "next/link";
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
import { ProviderFormDialog } from "@/components/admin/provider-form-dialog";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  HEALTHY: "default",
  DEGRADED: "secondary",
  OFFLINE: "destructive",
  MAINTENANCE: "secondary",
};

export default async function AdminProvidersPage() {
  const providers = await prisma.provider.findMany({
    orderBy: { priority: "asc" },
    include: { credentials: { where: { active: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorized upstream wholesale providers behind our gateways.
          </p>
        </div>
        <ProviderFormDialog />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Success rate</TableHead>
              <TableHead>Priority / Weight</TableHead>
              <TableHead>Monthly cost</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell>
                  <Link
                    href={`/admin/providers/${provider.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {provider.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {provider.credentials.length > 0 ? "Credential configured" : "No credential set"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[provider.healthStatus] ?? "secondary"}>
                    {provider.healthStatus}
                  </Badge>
                </TableCell>
                <TableCell>{provider.currentLatencyMs ?? "—"}ms</TableCell>
                <TableCell>
                  {provider.successRatePercent ? `${Number(provider.successRatePercent)}%` : "—"}
                </TableCell>
                <TableCell>
                  {provider.priority} / {provider.weight}
                </TableCell>
                <TableCell>${Number(provider.monthlyCost).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={provider.enabled ? "default" : "secondary"}>
                    {provider.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ProviderFormDialog
                    provider={{
                      id: provider.id,
                      name: provider.name,
                      slug: provider.slug,
                      enabled: provider.enabled,
                      priority: provider.priority,
                      weight: provider.weight,
                      apiBaseUrl: provider.apiBaseUrl ?? "",
                      notes: provider.notes ?? "",
                      hasCredential: provider.credentials.length > 0,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
