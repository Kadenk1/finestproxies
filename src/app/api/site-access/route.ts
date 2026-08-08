import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";

const SITE_ACCESS_COOKIE = "site_access";
const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    // Gate isn't active — nothing to check in against.
    return NextResponse.json({ error: "Site access is open." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await checkRateLimit(`site-access:${ip}`, 10, 15 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.password !== sitePassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ message: "Access granted." });
  response.cookies.set(SITE_ACCESS_COOKIE, sitePassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
