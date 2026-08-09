import { z } from "zod";

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().default(100),
  weight: z.coerce.number().int().default(100),
  apiBaseUrl: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  /** Only sent when the admin wants to set/rotate the secret; blank leaves it untouched. */
  apiKey: z.string().trim().max(500).optional().or(z.literal("")),
  /**
   * Extra named secrets beyond the primary API key — e.g. a provider whose
   * adapter needs an account ID, a zone/pool name, and a separate proxy
   * password. Each entry upserts a ProviderCredential by label; blank
   * entries are ignored so a saved form with empty trailing rows is safe.
   */
  extraCredentials: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        value: z.string().trim().min(1).max(500),
      }),
    )
    .optional(),
});

export type ProviderInput = z.infer<typeof providerSchema>;

export const providerProductSchema = z.object({
  productId: z.string().min(1),
  costPerGb: z.coerce.number().nonnegative().optional(),
  costPerIp: z.coerce.number().nonnegative().optional(),
  costPerPort: z.coerce.number().nonnegative().optional(),
  active: z.boolean().default(true),
});

export const providerLocationsSchema = z.object({
  locations: z.string().trim().max(2000).optional(),
});
