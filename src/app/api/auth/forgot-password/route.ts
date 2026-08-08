import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateVerificationToken } from "@/lib/auth/tokens";
import { forgotPasswordSchema } from "@/lib/validation/password-reset";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/send";

const GENERIC_RESPONSE = {
  message: "If that email exists, a reset link has been sent.",
};

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const { allowed } = await checkRateLimit(
    `forgot-password:ip:${ip}`,
    10,
    60 * 60,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (user) {
    const { token, tokenHash } = generateVerificationToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendPasswordResetEmail(user.email, token);
  }

  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}
