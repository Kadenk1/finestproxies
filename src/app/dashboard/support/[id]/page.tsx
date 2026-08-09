import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { ReplyForm } from "@/components/dashboard/reply-form";
import { cn } from "@/lib/utils";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  OPEN: "default",
  PENDING: "secondary",
  RESOLVED: "secondary",
  CLOSED: "destructive",
};

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: session!.user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{ticket.subject}</h1>
        <Badge variant={statusVariant[ticket.status] ?? "secondary"}>{ticket.status}</Badge>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((message) => {
          const isMe = message.authorId === session!.user.id;
          return (
            <div
              key={message.id}
              className={cn(
                "max-w-[80%] rounded-2xl border p-4 text-sm",
                isMe
                  ? "ml-auto border-brand-200 bg-brand-50 text-foreground"
                  : "border-border/70 bg-card text-foreground",
              )}
            >
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {isMe ? "You" : message.author.name ?? "Support"} ·{" "}
                {message.createdAt.toLocaleString()}
              </div>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </div>
          );
        })}
      </div>

      {ticket.status !== "CLOSED" && <ReplyForm ticketId={ticket.id} />}
    </div>
  );
}
