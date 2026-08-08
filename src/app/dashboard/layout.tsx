import type { ReactNode } from "react";
import Link from "next/link";
import { Network } from "lucide-react";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { brand } from "@/lib/config/brand";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/70 bg-white px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Network className="h-4.5 w-4.5" />
          </span>
          <span className="text-[15px] tracking-tight text-navy-900">{brand.name}</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session?.user?.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
