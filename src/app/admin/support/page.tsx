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

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  OPEN: "default",
  PENDING: "secondary",
  RESOLVED: "secondary",
  CLOSED: "destructive",
};

export default async function AdminSupportPage() {
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: "desc" },
    include: { user: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tickets.length} tickets</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>
                  <Link
                    href={`/admin/support/${ticket.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                </TableCell>
                <TableCell>{ticket.user.email}</TableCell>
                <TableCell>{ticket.priority}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[ticket.status] ?? "secondary"}>
                    {ticket.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {ticket.updatedAt.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
