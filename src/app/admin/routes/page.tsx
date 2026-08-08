import { prisma } from "@/lib/db/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteFormDialog } from "@/components/admin/route-form-dialog";
import { RouteRowActions } from "@/components/admin/route-row-actions";

export default async function AdminRoutesPage() {
  const [routes, gateways, providers, products] = await Promise.all([
    prisma.gatewayRoute.findMany({
      orderBy: [{ productId: "asc" }, { priority: "asc" }],
      include: { gateway: true, provider: true, product: true },
    }),
    prisma.gateway.findMany({ orderBy: { name: "asc" } }),
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Routes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Which gateway serves which product using which upstream provider. The
            routing engine (Phase 4) reads these to build its candidate set.
          </p>
        </div>
        <RouteFormDialog
          gateways={gateways.map((g) => ({ id: g.id, name: g.name }))}
          providers={providers.map((p) => ({ id: p.id, name: p.name }))}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((route) => (
              <TableRow key={route.id}>
                <TableCell className="font-medium text-navy-900">{route.product.name}</TableCell>
                <TableCell>{route.gateway.name}</TableCell>
                <TableCell>{route.provider.name}</TableCell>
                <TableCell>{route.priority}</TableCell>
                <TableCell>{route.weight}</TableCell>
                <TableCell>
                  <RouteRowActions
                    routeId={route.id}
                    priority={route.priority}
                    weight={route.weight}
                    enabled={route.enabled}
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
