import { z } from "zod";

export const generateProxySchema = z.object({
  productSlug: z.string().trim().min(1),
  country: z.string().trim().max(2).optional(),
  region: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  protocol: z.enum(["HTTP", "HTTPS", "SOCKS5"]),
  sessionType: z.enum(["ROTATING", "STICKY"]),
  sessionDurationMins: z.coerce.number().int().min(1).max(1440).optional(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

export type GenerateProxyInput = z.infer<typeof generateProxySchema>;
