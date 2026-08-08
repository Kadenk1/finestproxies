import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTicketForm } from "@/components/dashboard/create-ticket-form";
import Link from "next/link";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  OPEN: "default",
  PENDING: "secondary",
  RESOLVED: "secondary",
  CLOSED: "destructive",
};

export default async function SupportPage() {
  const session = await auth();
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session!.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-navy-900">Support</h1>
        {tickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-white p-10 text-center text-sm text-muted-foreground">
            No support tickets yet.
          </p>
        ) : (
          tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/support/${ticket.id}`}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-white p-4 transition-colors hover:bg-secondary/40"
            >
              <div>
                <div className="font-medium text-navy-900">{ticket.subject}</div>
                <div className="text-xs text-muted-foreground">
                  Updated {ticket.updatedAt.toLocaleDateString()}
                </div>
              </div>
              <Badge variant={statusVariant[ticket.status] ?? "secondary"}>{ticket.status}</Badge>
            </Link>
          ))
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTicketForm />
        </CardContent>
      </Card>
    </div>
  );
}
