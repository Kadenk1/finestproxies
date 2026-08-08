import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { revokeProxyCredential } from "@/services/gateway/gateway-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await revokeProxyCredential(session.user.id, id);
    return NextResponse.json({ message: "Credential revoked." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revoke credential.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
