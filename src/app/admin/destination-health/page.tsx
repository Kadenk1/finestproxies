import { getDestinationHealthRows } from "@/lib/data/destination-health";
import { bytesToGb } from "@/services/usage/usage-service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function formatMs(ms: number | null): string {
  return ms === null ? "—" : `${ms.toLocaleString()} ms`;
}

export default async function AdminDestinationHealthPage() {
  const rows = await getDestinationHealthRows();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Destination health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rolling 30-minute performance per destination × upstream pool — the same data{" "}
          <code className="text-xs">routing-engine.ts</code> reads to prefer one pool over another for a
          specific site. Destinations follow the same pattern matching as Site rules on{" "}
          <code className="text-xs">/admin/settings</code>; a hostname with no matching rule appears as{" "}
          <code className="text-xs">default</code>.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destination</TableHead>
              <TableHead>Pool</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Success rate</TableHead>
              <TableHead>Median</TableHead>
              <TableHead>p95</TableHead>
              <TableHead>Timeouts</TableHead>
              <TableHead>TCP fail</TableHead>
              <TableHead>TLS fail</TableHead>
              <TableHead>Bandwidth</TableHead>
              <TableHead className="text-right">Active sessions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">
                  No connection activity in the last 24 hours yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={`${row.destinationPattern}:${row.providerSlug}`}>
                <TableCell className="font-mono text-xs">{row.destinationPattern}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.providerSlug}</TableCell>
                <TableCell>
                  {row.scorePending ? (
                    <Badge variant="outline">pending</Badge>
                  ) : row.degraded ? (
                    <Badge variant="destructive">degraded</Badge>
                  ) : (
                    <Badge variant="secondary">healthy</Badge>
                  )}
                </TableCell>
                <TableCell>{row.totalAttempts.toLocaleString()}</TableCell>
                <TableCell
                  className={
                    row.successRatePercent < 80 && row.totalAttempts > 0
                      ? "font-medium text-destructive"
                      : "font-medium text-foreground"
                  }
                >
                  {row.totalAttempts > 0 ? `${row.successRatePercent.toFixed(1)}%` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatMs(row.medianLatencyMs)}</TableCell>
                <TableCell className="text-muted-foreground">{formatMs(row.p95LatencyMs)}</TableCell>
                <TableCell className="text-muted-foreground">{row.timeoutCount}</TableCell>
                <TableCell className="text-muted-foreground">{row.tcpFailureCount}</TableCell>
                <TableCell className="text-muted-foreground">{row.tlsFailureCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {bytesToGb(row.bytesUploaded + row.bytesDownloaded).toFixed(3)} GB
                </TableCell>
                <TableCell className="text-right">{row.activeSessions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
