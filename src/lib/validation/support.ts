import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(160),
  category: z.string().trim().max(80).optional(),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(4000),
});

export const replySchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(4000),
});
