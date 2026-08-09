"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DashboardNavLinks } from "@/components/dashboard/sidebar";
import { Logo } from "@/components/shared/logo";
import { brand } from "@/lib/config/brand";

export function DashboardMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
        <div className="flex h-16 items-center gap-2 border-b border-border/70 px-5">
          <Logo className="h-8 w-8" />
          <span className="text-[15px] tracking-tight text-foreground">{brand.name}</span>
        </div>
        <DashboardNavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
