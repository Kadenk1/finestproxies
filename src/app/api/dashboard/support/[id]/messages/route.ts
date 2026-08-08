import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { replySchema } from "@/lib/validation/support";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  const message = await prisma.supportTicketMessage.create({
    data: { ticketId: id, authorId: session.user.id, body: parsed.data.body },
  });

  await prisma.supportTicket.update({
    where: { id },
    data: { status: ticket.status === "CLOSED" ? "OPEN" : ticket.status },
  });

  return NextResponse.json({ message }, { status: 201 });
}
