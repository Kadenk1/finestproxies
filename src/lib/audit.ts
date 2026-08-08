import { prisma } from "@/lib/db/prisma";
import type { UserRole } from "@/generated/prisma/enums";

export interface AuditLogInput {
  actorId: string;
  actorRole: UserRole;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/** Records a sensitive admin action. Never throws — audit logging must not break the action it's recording. */
export async function logAdminAction(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as never,
        ipAddress: input.ipAddress ?? undefined,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}

export function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
