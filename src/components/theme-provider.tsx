"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Single provider for the whole app — next-themes manages the .dark class
 * on <html> from exactly one instance, so per-section theming has to work
 * by changing what THIS provider forces, not by nesting a second one deeper
 * in the tree (that doesn't override the outer instance's class management).
 *
 * Dark mode is a dashboard/admin-only feature: everywhere else (marketing,
 * auth, the coming-soon gate) is forced light regardless of OS preference
 * or whatever a logged-in user picked inside the portal.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname();
  const isPortal = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={isPortal ? undefined : "light"}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
