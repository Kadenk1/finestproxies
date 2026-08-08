import { z } from "zod";

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Uppercase letters, numbers, and hyphens only"),
  type: z.enum(["PERCENT", "FIXED_AMOUNT", "FREE_GB"]),
  value: z.coerce.number().positive(),
  maxRedemptions: z.coerce.number().int().positive().optional(),
  active: z.boolean().default(true),
  expiresAt: z.string().trim().optional().or(z.literal("")),
});

export type CouponInput = z.infer<typeof couponSchema>;
