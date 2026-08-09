"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/config/brand";
import { adminNavLinks } from "@/components/admin/sidebar";

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-[15px] tracking-tight">{brand.name} Admin</span>
          </div>
          <ThemeToggle className="text-muted-foreground hover:text-sidebar-foreground" />
        </div>
        <nav className="space-y-0.5 overflow-y-auto px-3 py-4">
          {adminNavLinks.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
