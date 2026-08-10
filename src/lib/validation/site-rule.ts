import { z } from "zod";

// Deliberately narrow: an exact hostname ("target.com") or a "*." prefix
// wildcard ("*.target.com") — not a general glob/regex. Matches
// siteRuleMatches() in gateway-tuning.ts exactly, so a pattern accepted
// here is guaranteed to behave the way this form implies.
const patternRegex = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export const siteRuleSchema = z.object({
  pattern: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Pattern is required")
    .max(255)
    .regex(patternRegex, 'Use a domain like "target.com" or "*.target.com"'),
  label: z.string().trim().max(120).optional().or(z.literal("")),
  enabled: z.boolean().default(true),
  // null/undefined = "use the global default" — every field here is an
  // override, not a required value, so a rule can adjust just one knob.
  qualityCheckEnabled: z.boolean().nullable().optional(),
  qualityCheckOnRotation: z.boolean().nullable().optional(),
  issuanceQualityCheckMaxAttempts: z.coerce.number().int().min(1).max(10).nullable().optional(),
  rotationQualityCheckMaxAttempts: z.coerce.number().int().min(1).max(10).nullable().optional(),
  defaultStickyWindowMins: z.coerce.number().int().min(1).max(1440).nullable().optional(),

  // ---- Routing profile --------------------------------------------------
  preferredProviderSlug: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  // Comma-separated in the form UI, normalized to an array here — matches
  // how a non-technical admin would naturally type "iproyal, bright-data"
  // rather than building a multi-select from live provider slugs.
  fallbackProviderSlugs: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return [];
      const list = Array.isArray(v) ? v : v.split(",");
      return list.map((s) => s.trim()).filter(Boolean);
    }),
  region: z
    .string()
    .trim()
    .toUpperCase()
    .max(2)
    .nullable()
    .optional()
    .or(z.literal("")),
  connectionTimeoutMs: z.coerce.number().int().min(1000).max(120_000).nullable().optional(),
  maxConnectionAttempts: z.coerce.number().int().min(1).max(10).nullable().optional(),
  concurrencyLimit: z.coerce.number().int().min(1).nullable().optional(),
  routingWeight: z.coerce.number().int().min(1).max(1000).nullable().optional(),
});

export type SiteRuleInput = z.infer<typeof siteRuleSchema>;
