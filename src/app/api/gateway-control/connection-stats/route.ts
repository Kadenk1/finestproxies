import { NextResponse } from "next/server";
import { isAuthorizedGatewayAgent } from "@/lib/auth/require-gateway-agent";
import { connectionStatsIngestSchema } from "@/lib/validation/gateway-control";
import { prisma } from "@/lib/db/prisma";
import { resolveDestinationPattern } from "@/lib/config/gateway-tuning";

/**
 * Gateway Control API: batched connection-outcome ingestion. gateway-agent
 * buffers CONNECT/tunnel outcomes locally and POSTs them here periodically
 * (batched, not one request per connection — see gateway-agent/index.js's
 * connection-stats reporter) so this never adds a synchronous round-trip
 * to a customer's live request.
 *
 * Each event's targetHost is resolved to its SiteRule-pattern bucket here
 * (not by the agent, which has no DB access) before being written as a
 * ConnectionEvent row — this is the raw source of truth the background
 * job (connection-health.ts's recomputeHealthScores) later aggregates into
 * the rolling health scores routing-engine.ts actually reads.
 */
export async function POST(request: Request) {
  if (!isAuthorizedGatewayAgent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = connectionStatsIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const rows = await Promise.all(
    parsed.data.events.map(async (event) => ({
      destinationPattern: await resolveDestinationPattern(event.targetHost),
      providerSlug: event.providerSlug,
      success: event.success,
      errorClass: event.errorClass ?? null,
      connectLatencyMs: Math.round(event.connectLatencyMs),
      bytesUploaded: BigInt(Math.round(event.bytesUploaded)),
      bytesDownloaded: BigInt(Math.round(event.bytesDownloaded)),
      sessionId: event.sessionId ?? null,
      occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    })),
  );

  const result = await prisma.connectionEvent.createMany({ data: rows });

  return NextResponse.json({ inserted: result.count });
}
