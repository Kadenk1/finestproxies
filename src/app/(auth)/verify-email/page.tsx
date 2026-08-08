import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";

export const metadata: Metadata = { title: "Verify email" };

async function verify(token: string | undefined) {
  if (!token) return false;
  const tokenHash = hashToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return false;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return true;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const success = await verify(token);

  return (
    <div className="text-center">
      {success ? (
        <>
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h1 className="mt-4 text-xl font-semibold text-navy-900">Email verified</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your email has been verified. You can now log in.
          </p>
        </>
      ) : (
        <>
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-navy-900">
            Link invalid or expired
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This verification link is invalid or has expired. Log in and
            request a new one from your account settings.
          </p>
        </>
      )}
      <Link
        href="/login"
        className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline"
      >
        Go to login
      </Link>
    </div>
  );
}
