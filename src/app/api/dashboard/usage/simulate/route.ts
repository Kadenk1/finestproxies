import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { simulateUsageForCredential } from "@/services/usage/usage-service";

const schema = z.object({ credentialId: z.string().min(1) });

/**
 * Dev-mode convenience endpoint: injects a burst of simulated traffic
 * through a credential so usage/balance can be exercised without real
 * proxy infrastructure. Tied to MOCK_PROVIDER — remove or gate behind an
 * admin/dev flag once a real provider is wired up.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const record = await simulateUsageForCredential(session.user.id, parsed.data.credentialId);
    return NextResponse.json({
      totalBytes: record.totalBytes.toString(),
      requestCount: record.requestCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to simulate usage.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
