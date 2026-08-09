import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import { TicketStatusSelect } from "@/components/admin/ticket-status-select";
import { AdminReplyForm } from "@/components/admin/admin-reply-form";

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: true,
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ticket.user.email}</p>
        </div>
        <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
      </div>

      <div className="space-y-3">
        {ticket.messages.map((message) => {
          const isCustomer = message.authorId === ticket.userId;
          return (
            <div
              key={message.id}
              className={cn(
                "max-w-[80%] rounded-2xl border p-4 text-sm",
                isCustomer
                  ? "border-border/70 bg-card text-foreground"
                  : "ml-auto border-brand-200 bg-brand-50 text-foreground",
              )}
            >
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {isCustomer ? ticket.user.email : `${message.author.name ?? "Support"} (staff)`} ·{" "}
                {message.createdAt.toLocaleString()}
              </div>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </div>
          );
        })}
      </div>

      <AdminReplyForm ticketId={ticket.id} />
    </div>
  );
}
