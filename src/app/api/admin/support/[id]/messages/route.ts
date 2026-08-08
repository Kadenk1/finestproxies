import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { replySchema } from "@/lib/validation/support";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const message = await prisma.supportTicketMessage.create({
    data: { ticketId: id, authorId: session.user.id, body: parsed.data.body },
  });

  await prisma.supportTicket.update({ where: { id }, data: { status: "PENDING" } });

  return NextResponse.json({ message }, { status: 201 });
}
