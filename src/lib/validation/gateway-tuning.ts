import { z } from "zod";

export const gatewayTuningSchema = z.object({
  qualityCheckEnabled: z.boolean(),
  qualityCheckOnRotation: z.boolean(),
  issuanceQualityCheckMaxAttempts: z.number().int().min(1).max(10),
  rotationQualityCheckMaxAttempts: z.number().int().min(1).max(10),
  defaultStickyWindowMins: z.number().int().min(1).max(1440),
});

export type GatewayTuningInput = z.infer<typeof gatewayTuningSchema>;
