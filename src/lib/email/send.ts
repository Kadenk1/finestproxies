import { brand } from "@/lib/config/brand";

/**
 * Transactional email sending.
 *
 * TODO(production): wire up a real provider (Resend, Postmark, SES, etc).
 * In development we log the email + link to the console so the full
 * verification/reset flow can be exercised without external infrastructure.
 */

const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function logDevEmail(to: string, subject: string, body: string) {
  console.log(
    `\n----- [dev email] -----\nTo: ${to}\nSubject: ${subject}\n\n${body}\n------------------------\n`,
  );
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${appUrl}/verify-email?token=${token}`;
  const subject = `Verify your ${brand.name} account`;
  const body = `Welcome to ${brand.name}!\n\nVerify your email address:\n${link}\n\nThis link expires in 24 hours.`;

  if (process.env.NODE_ENV !== "production") {
    logDevEmail(to, subject, body);
    return;
  }

  // TODO(production): send via configured email provider.
  logDevEmail(to, subject, body);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${appUrl}/reset-password?token=${token}`;
  const subject = `Reset your ${brand.name} password`;
  const body = `A password reset was requested for your account.\n\nReset your password:\n${link}\n\nIf you didn't request this, you can ignore this email. This link expires in 1 hour.`;

  if (process.env.NODE_ENV !== "production") {
    logDevEmail(to, subject, body);
    return;
  }

  // TODO(production): send via configured email provider.
  logDevEmail(to, subject, body);
}
