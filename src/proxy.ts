import { NextResponse } from "next/server";
import { auth } from "@/auth";

const SITE_ACCESS_COOKIE = "site_access";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Pre-launch site-wide gate. Only active when SITE_PASSWORD is set —
  // unset it (or remove the env var) to open the site to everyone with no
  // code changes. Checked before anything else, including dashboard/admin
  // auth below.
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    const hasAccess = req.cookies.get(SITE_ACCESS_COOKIE)?.value === sitePassword;
    if (!hasAccess) {
      const gateUrl = new URL("/coming-soon", req.url);
      gateUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(gateUrl);
    }
  }

  const user = req.auth?.user;
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");

  if (isDashboardRoute && !user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute) {
    if (!user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Runs on everything except Next internals/static files and the gate
  // page + its submit endpoint (those two must stay reachable, or nobody
  // could ever get past the gate).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|coming-soon|api/site-access).*)",
  ],
};
