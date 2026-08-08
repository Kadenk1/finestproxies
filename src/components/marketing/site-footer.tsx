import Link from "next/link";
import { Network } from "lucide-react";
import { brand } from "@/lib/config/brand";

const footerLinks = {
  Product: [
    { href: "/#products", label: "Residential Proxies" },
    { href: "/#products", label: "ISP Proxies" },
    { href: "/#products", label: "Mobile Proxies" },
    { href: "/pricing", label: "Pricing" },
  ],
  Resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/faq", label: "FAQ" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ],
  Legal: [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/acceptable-use", label: "Acceptable Use Policy" },
  ],
  Account: [
    { href: "/login", label: "Log in" },
    { href: "/register", label: "Create account" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Network className="h-4.5 w-4.5" />
              </span>
              <span className="text-[15px] tracking-tight text-navy-900">
                {brand.name}
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {brand.tagline}. Residential, ISP, and mobile proxy
              infrastructure through one platform.
            </p>
          </div>

          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-sm font-semibold text-navy-900">{heading}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/70 pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Proxy usage is subject to our{" "}
            <Link href="/acceptable-use" className="underline underline-offset-2 hover:text-foreground">
              Acceptable Use Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
