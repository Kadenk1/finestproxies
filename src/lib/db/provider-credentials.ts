import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/crypto/secrets";

/**
 * Rotates a labeled provider secret: deactivates whatever's currently active
 * under that label and creates a new encrypted row. Labels are how adapters
 * that need more than one secret (e.g. an account ID, a zone name, and a
 * separate proxy password) look up each piece — see
 * `src/services/providers/bright-data.ts` for a consumer.
 */
export async function upsertProviderCredential(
  providerId: string,
  label: string,
  value: string,
) {
  await prisma.providerCredential.updateMany({
    where: { providerId, label, active: true },
    data: { active: false, rotatedAt: new Date() },
  });
  await prisma.providerCredential.create({
    data: {
      providerId,
      type: "API_KEY",
      label,
      encryptedValue: encryptSecret(value),
    },
  });
}
