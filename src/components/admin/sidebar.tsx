"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Package,
  Tags,
  Building2,
  Server,
  Route as RouteIcon,
  Activity,
  CreditCard,
  Ticket,
  LifeBuoy,
  Settings,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/config/brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/shared/logo";

export const adminNavLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/pricing", label: "Pricing", icon: Tags },
  { href: "/admin/providers", label: "Providers", icon: Building2 },
  { href: "/admin/gateways", label: "Gateways", icon: Server },
  { href: "/admin/routes", label: "Routes", icon: RouteIcon },
  { href: "/admin/usage", label: "Usage", icon: Activity },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/settings", label: "System Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-navy-900 lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-white">
          <Logo className="h-8 w-8" />
          <span className="text-[15px] tracking-tight">{brand.name} Admin</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {adminNavLinks.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-navy-200 hover:bg-white/5 hover:text-white",
              )}
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <SignOutButton className="w-full justify-start text-navy-200 hover:bg-white/5 hover:text-white" />
      </div>
    </aside>
  );
}
