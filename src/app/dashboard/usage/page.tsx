import { auth } from "@/auth";
import { getUsageHistory } from "@/lib/data/dashboard";
import { bytesToGb } from "@/services/usage/usage-service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function UsagePage() {
  const session = await auth();
  const records = await getUsageHistory(session!.user.id, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bandwidth and request history across all products, most recent first.
        </p>
      </div>

      {records.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 bg-white p-10 text-center text-sm text-muted-foreground">
          No usage recorded yet. Generate a credential and use the &quot;Simulate
          usage&quot; action to see data here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Downloaded</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {r.occurredAt.toLocaleString()}
                  </TableCell>
                  <TableCell>{r.product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.gateway.name}</TableCell>
                  <TableCell>{bytesToGb(r.bytesUploaded).toFixed(3)} GB</TableCell>
                  <TableCell>{bytesToGb(r.bytesDownloaded).toFixed(3)} GB</TableCell>
                  <TableCell className="font-medium text-navy-900">
                    {bytesToGb(r.totalBytes).toFixed(3)} GB
                  </TableCell>
                  <TableCell className="text-right">{r.requestCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
