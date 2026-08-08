import { z } from "zod";

export const updateCustomerStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
  reason: z.string().trim().max(500).optional(),
});

export const addNoteSchema = z.object({
  note: z.string().trim().min(1, "Note can't be empty").max(2000),
});
