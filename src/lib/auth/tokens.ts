import { createHash, randomBytes } from "crypto";

/**
 * Opaque single-use tokens (email verification, password reset). Only the
 * SHA-256 hash is persisted, mirroring password-reset best practice — a
 * leaked database dump doesn't yield usable tokens.
 */
export function generateVerificationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
