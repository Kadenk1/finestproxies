import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createTicketSchema } from "@/lib/validation/support";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(`support-ticket:${session.user.id}`, 10, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many tickets created. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session.user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      messages: {
        create: [{ authorId: session.user.id, body: parsed.data.message }],
      },
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
