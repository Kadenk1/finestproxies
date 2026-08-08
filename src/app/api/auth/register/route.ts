import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateVerificationToken } from "@/lib/auth/tokens";
import { registerSchema } from "@/lib/validation/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendVerificationEmail } from "@/lib/email/send";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const { allowed } = await checkRateLimit(`register:ip:${ip}`, 10, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, password, companyName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Generic message — do not reveal whether the account already exists.
    return NextResponse.json(
      { message: "If that email is available, an account has been created." },
      { status: 200 },
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      companyName: companyName || null,
      balance: { create: { cashBalance: 0 } },
    },
  });

  const { token, tokenHash } = generateVerificationToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail(user.email, token);

  return NextResponse.json(
    { message: "Account created. Check your email to verify your account." },
    { status: 201 },
  );
}
