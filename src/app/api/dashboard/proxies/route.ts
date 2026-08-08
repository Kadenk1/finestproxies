import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateProxySchema } from "@/lib/validation/proxy-generator";
import { generateProxyCredential } from "@/services/gateway/gateway-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    `generate-proxy:${session.user.id}`,
    30,
    60 * 60,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many credentials generated. Try again later." },
      { status: 429 },
    );
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

  try {
    const results = [];
    for (let i = 0; i < quantity; i++) {
      results.push(await generateProxyCredential({ userId: session.user.id, ...params }));
    }
    return NextResponse.json({ credentials: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate credential.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
