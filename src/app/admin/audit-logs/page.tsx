import { prisma } from "@/lib/db/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function AdminAuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Most recent 200 sensitive admin actions.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No audit events recorded yet.
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.actor?.email ?? "system"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.targetType ? `${log.targetType}:${log.targetId?.slice(0, 8)}` : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {log.ipAddress ?? "—"}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {log.createdAt.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
