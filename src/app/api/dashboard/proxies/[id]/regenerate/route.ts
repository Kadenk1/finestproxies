import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { regenerateProxyCredential } from "@/services/gateway/gateway-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const credential = await regenerateProxyCredential(session.user.id, id);
    return NextResponse.json({ credential });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to regenerate credential.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
