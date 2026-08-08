import { NextResponse } from "next/server";
import { isAuthorizedGatewayAgent } from "@/lib/auth/require-gateway-agent";
import { heartbeatSchema } from "@/lib/validation/gateway-control";
import { recordHeartbeat } from "@/services/gateway/heartbeat-service";
import { serializeBigInts } from "@/lib/serialize";

/**
 * Gateway Control API: heartbeat ingestion. A gateway agent calls this
 * periodically to report its own health — this is what keeps the admin
 * Gateways page (and, once alerting exists, on-call) current without a
 * human updating status by hand.
 */
export async function POST(request: Request) {
  if (!isAuthorizedGatewayAgent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const gateway = await recordHeartbeat(parsed.data);
    return NextResponse.json(serializeBigInts({ gateway }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record heartbeat.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
