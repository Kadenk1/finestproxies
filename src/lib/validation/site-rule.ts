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
});

export type SiteRuleInput = z.infer<typeof siteRuleSchema>;
