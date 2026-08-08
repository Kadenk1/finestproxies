import type { ReactNode } from "react";
import Link from "next/link";
import { Network } from "lucide-react";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { brand } from "@/lib/config/brand";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/70 bg-navy-900 px-4 py-3 sm:px-6">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Network className="h-4.5 w-4.5" />
          </span>
          <span className="text-[15px] tracking-tight">{brand.name} Admin</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-navy-200">{session?.user?.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
