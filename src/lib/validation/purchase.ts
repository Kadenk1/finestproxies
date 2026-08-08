import { z } from "zod";

export const purchaseSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
