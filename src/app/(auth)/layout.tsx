import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { brand } from "@/lib/config/brand";
import { ThemeProvider } from "@/components/theme-provider";

// Same as the marketing layout — forced light, unaffected by any dashboard/
// admin theme choice.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider forcedTheme="light">
      <div className="flex min-h-full flex-col bg-hero-gradient">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
            <Logo className="h-9 w-9" />
            <span className="text-base tracking-tight text-navy-900">
              {brand.name}
            </span>
          </Link>
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-white p-8 card-glow">
            {children}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
