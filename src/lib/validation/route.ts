import { z } from "zod";

export const gatewayRouteSchema = z.object({
  gatewayId: z.string().min(1, "Gateway is required"),
  providerId: z.string().min(1, "Provider is required"),
  productId: z.string().min(1, "Product is required"),
  priority: z.coerce.number().int().default(100),
  weight: z.coerce.number().int().default(100),
  enabled: z.boolean().default(true),
});

export type GatewayRouteInput = z.infer<typeof gatewayRouteSchema>;
