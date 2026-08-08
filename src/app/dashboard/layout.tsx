import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardMobileNav } from "@/components/dashboard/mobile-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const balance = session?.user?.id
    ? await prisma.customerBalance.findUnique({ where: { userId: session.user.id } })
    : null;

  return (
    <div className="flex min-h-full bg-background">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/70 bg-white px-4 sm:px-6">
          <DashboardMobileNav />
          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary" className="gap-1.5 py-1.5">
              <Wallet className="h-3.5 w-3.5" />
              ${Number(balance?.cashBalance ?? 0).toFixed(2)}
            </Badge>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session?.user?.email}
            </span>
            <div className="lg:hidden">
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
