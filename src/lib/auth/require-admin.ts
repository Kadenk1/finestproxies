import { auth } from "@/auth";

/**
 * Server-side guard for admin API routes. The `/admin` *pages* are already
 * gated by role in `src/proxy.ts`, but API routes live under `/api/admin`
 * (outside that matcher) so each handler checks independently — defense in
 * depth beats relying solely on page-level middleware.
 */
export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}
