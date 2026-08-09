import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeProvider } from "@/components/theme-provider";

// Dark mode is a dashboard/admin-only feature — force light here regardless
// of what a logged-in user picked in the portal, so the public marketing
// site never changes based on OS preference or a stored theme choice.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider forcedTheme="light">
      <div className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </ThemeProvider>
  );
}
