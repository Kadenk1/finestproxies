"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wifi,
  Wand2,
  Activity,
  ShoppingBag,
  CreditCard,
  Code2,
  Settings,
  LifeBuoy,
  ChevronDown,
  Users,
  Router,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/config/brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/shared/logo";

const proxyLinks = [
  { href: "/dashboard/proxies/residential", label: "Residential", icon: Users },
  { href: "/dashboard/proxies/isp", label: "ISP", icon: Router },
  { href: "/dashboard/proxies/mobile", label: "Mobile", icon: Smartphone },
];

const navLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/proxy-generator", label: "Proxy Generator", icon: Wand2 },
  { href: "/dashboard/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/api", label: "API", icon: Code2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-navy-600 hover:bg-secondary hover:text-navy-900",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function DashboardNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [proxiesOpen, setProxiesOpen] = useState(pathname.startsWith("/dashboard/proxies"));

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      <div onClick={onNavigate}>
        <NavLink
          href="/dashboard"
          label="Overview"
          icon={LayoutDashboard}
          active={pathname === "/dashboard"}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setProxiesOpen((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/dashboard/proxies")
              ? "text-brand-700"
              : "text-navy-600 hover:bg-secondary hover:text-navy-900",
          )}
        >
          <span className="flex items-center gap-2.5">
            <Wifi className="h-4 w-4" />
            Proxies
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", proxiesOpen && "rotate-180")}
          />
        </button>
        {proxiesOpen && (
          <div className="mt-1 space-y-1 pl-8">
            {proxyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                  pathname === link.href
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-navy-500 hover:bg-secondary hover:text-navy-900",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {navLinks.slice(1).map((link) => (
        <div key={link.href} onClick={onNavigate}>
          <NavLink
            href={link.href}
            label={link.label}
            icon={link.icon}
            active={pathname === link.href}
          />
        </div>
      ))}
    </nav>
  );
}

export function DashboardSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border/70 px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo className="h-8 w-8" />
          <span className="text-[15px] tracking-tight text-navy-900">{brand.name}</span>
        </Link>
      </div>

      <DashboardNavLinks />

      <div className="border-t border-border/70 p-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
