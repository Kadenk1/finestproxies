import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  type: z.enum(["RESIDENTIAL", "ISP", "MOBILE"]),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  active: z.boolean().default(true),
  billingUnit: z.enum(["GB", "IP_MONTH", "PORT_MONTH", "FLAT"]),
  retailPrice: z.coerce.number().positive("Must be greater than 0"),
  internalCostEstimate: z.coerce.number().nonnegative(),
  minPurchase: z.coerce.number().positive(),
  maxPurchase: z.coerce.number().positive(),
  sortOrder: z.coerce.number().int().default(0),
  locations: z.string().trim().max(2000).optional(), // comma-separated ISO country codes
});

export type ProductInput = z.infer<typeof productSchema>;
