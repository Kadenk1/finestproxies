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
import { GatewayFormDialog } from "@/components/admin/gateway-form-dialog";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  HEALTHY: "default",
  DEGRADED: "secondary",
  OFFLINE: "destructive",
  MAINTENANCE: "secondary",
};

function formatUptime(seconds: bigint) {
  const days = Number(seconds) / 86400;
  return `${days.toFixed(1)}d`;
}

function formatBandwidth(bps: bigint) {
  const mbps = Number(bps) / 1_000_000;
  return `${mbps.toFixed(1)} Mbps`;
}

export default async function AdminGatewaysPage() {
  const gateways = await prisma.gateway.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gateways</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Infrastructure we operate that customers connect through.
          </p>
        </div>
        <GatewayFormDialog />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gateway</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>CPU</TableHead>
              <TableHead>Memory</TableHead>
              <TableHead>Connections</TableHead>
              <TableHead>Bandwidth</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Uptime</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gateways.map((gateway) => (
              <TableRow key={gateway.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{gateway.name}</div>
                  <div className="text-xs text-muted-foreground">{gateway.hostname}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[gateway.status] ?? "secondary"}>
                    {gateway.status}
                  </Badge>
                </TableCell>
                <TableCell>{gateway.region ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{gateway.ipAddress ?? "—"}</TableCell>
                <TableCell>{gateway.cpuPercent ? `${Number(gateway.cpuPercent)}%` : "—"}</TableCell>
                <TableCell>
                  {gateway.memoryPercent ? `${Number(gateway.memoryPercent)}%` : "—"}
                </TableCell>
                <TableCell>{gateway.activeConnections}</TableCell>
                <TableCell>{formatBandwidth(gateway.bandwidthBps)}</TableCell>
                <TableCell>{gateway.latencyMs ?? "—"}ms</TableCell>
                <TableCell>{formatUptime(gateway.uptimeSeconds)}</TableCell>
                <TableCell className="text-right">
                  <GatewayFormDialog
                    gateway={{
                      id: gateway.id,
                      name: gateway.name,
                      hostname: gateway.hostname,
                      ipAddress: gateway.ipAddress ?? "",
                      region: gateway.region ?? "",
                      status: gateway.status,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        CPU, memory, connections, bandwidth, latency, and uptime are reported by gateway
        agents via heartbeat (see the <code>GatewayHealth</code> model). In development
        these reflect the last seeded/reported values — the live heartbeat ingestion
        endpoint ships in Phase 4.
      </p>
    </div>
  );
}
