import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { addNoteSchema } from "@/lib/validation/admin";
import { logAdminAction, requestIp } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = addNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const note = await prisma.accountNote.create({
    data: { userId: id, authorId: session.user.id, note: parsed.data.note },
    include: { author: true },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "customer.note_added",
    targetType: "User",
    targetId: id,
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ note }, { status: 201 });
}
