import { z } from "zod";

export const planSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
  price: z.coerce.number().positive(),
  unitAllowance: z.coerce.number().positive(),
  active: z.boolean().default(true),
});

export type PlanInput = z.infer<typeof planSchema>;
