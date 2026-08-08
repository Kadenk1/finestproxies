import { z } from "zod";

export const gatewaySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  hostname: z.string().trim().min(1, "Hostname is required").max(200),
  ipAddress: z.string().trim().max(64).optional().or(z.literal("")),
  region: z.string().trim().max(80).optional().or(z.literal("")),
  status: z.enum(["HEALTHY", "DEGRADED", "OFFLINE", "MAINTENANCE"]),
});

export type GatewayInput = z.infer<typeof gatewaySchema>;
