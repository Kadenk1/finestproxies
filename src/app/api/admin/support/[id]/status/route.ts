import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db/prisma";
import { logAdminAction, requestIp } from "@/lib/audit";

const schema = z.object({ status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  await logAdminAction({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "support_ticket.status_changed",
    targetType: "SupportTicket",
    targetId: ticket.id,
    metadata: { status: parsed.data.status },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ ticket });
}
