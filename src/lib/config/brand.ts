/**
 * Single source of truth for brand identity.
 * Change these values (or the underlying env vars) to rebrand the entire app —
 * marketing site, dashboard, emails, docs, and seed data all read from here.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Finest Proxies",
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME ?? "Finest Proxies",
  domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? "finestproxies.com",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@finestproxies.com",
  legalEmail: process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? "legal@finestproxies.com",
  twitter: process.env.NEXT_PUBLIC_BRAND_TWITTER ?? "@finestproxies",
  tagline: "Premium Proxy Infrastructure Built for Performance",
} as const;

/** Gateway hostnames customers connect to. Kept separate from provider hosts. */
export const gatewayHosts = {
  residential: `resi.${brand.domain}`,
  isp: `isp.${brand.domain}`,
  mobile: `mobile.${brand.domain}`,
  generic: `proxy.${brand.domain}`,
} as const;

export const gatewayPorts = {
  http: 8000,
  socks5: 1080,
} as const;
