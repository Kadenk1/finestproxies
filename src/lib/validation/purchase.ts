import { z } from "zod";

export const purchaseSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  // Coupon codes are always stored uppercase (see couponSchema) — normalize
  // here so a customer typing lowercase still matches.
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(60)
    .optional()
    .or(z.literal("")),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
