import { prisma } from "@/lib/db/prisma";
import type { HeartbeatInput } from "@/lib/validation/gateway-control";

/**
 * Applies a gateway agent's heartbeat: updates the Gateway row's live
 * snapshot (what the admin Gateways table reads) and appends a
 * GatewayHealth history row (what a future health-over-time chart reads).
 */
export async function recordHeartbeat(input: HeartbeatInput) {
  const gateway = await prisma.gateway.findUnique({ where: { hostname: input.hostname } });
  if (!gateway) {
    throw new Error(`No gateway registered for hostname "${input.hostname}"`);
  }

  const bandwidthBps =
    input.bandwidthBps !== undefined ? BigInt(Math.round(input.bandwidthBps)) : undefined;
  const uptimeSeconds =
    input.uptimeSeconds !== undefined ? BigInt(Math.round(input.uptimeSeconds)) : undefined;

  const [updated] = await prisma.$transaction([
    prisma.gateway.update({
      where: { id: gateway.id },
      data: {
        status: input.status,
        cpuPercent: input.cpuPercent,
        memoryPercent: input.memoryPercent,
        activeConnections: input.activeConnections,
        bandwidthBps,
        latencyMs: input.latencyMs,
        uptimeSeconds,
        lastHeartbeatAt: new Date(),
      },
    }),
    prisma.gatewayHealth.create({
      data: {
        gatewayId: gateway.id,
        status: input.status,
        cpuPercent: input.cpuPercent,
        memoryPercent: input.memoryPercent,
        activeConnections: input.activeConnections,
        bandwidthBps,
        latencyMs: input.latencyMs,
      },
    }),
  ]);

  return updated;
}
