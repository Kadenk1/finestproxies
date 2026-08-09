import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateProxySchema } from "@/lib/validation/proxy-generator";
import { generateProxyCredentials } from "@/services/gateway/gateway-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = generateProxySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { quantity, ...params } = parsed.data;

  // Two limits: how often this endpoint gets called, and how many
  // credentials get issued in total — a batch request for 5000 at once
  // should count against volume even though it's a single call.
  const callLimit = await checkRateLimit(`generate-proxy:${session.user.id}`, 100, 60 * 60);
  if (!callLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }
  const volumeLimit = await checkRateLimit(
    `generate-proxy-volume:${session.user.id}`,
    10_000,
    60 * 60,
    quantity,
  );
  if (!volumeLimit.allowed) {
    return NextResponse.json(
      { error: "Too many credentials generated this hour. Try again later." },
      { status: 429 },
    );
  }

  try {
    const results = await generateProxyCredentials({ userId: session.user.id, ...params }, quantity);
    return NextResponse.json({ credentials: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate credentials.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
