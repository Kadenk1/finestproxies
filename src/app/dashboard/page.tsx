import { auth } from "@/auth";

export default async function DashboardOverviewPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-navy-900">
        Welcome{session?.user?.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account is signed in as {session?.user?.email} ({session?.user?.role}).
        The full customer dashboard (balances, proxy generator, usage,
        orders, billing) is built out in Phase 2.
      </p>
    </div>
  );
}
