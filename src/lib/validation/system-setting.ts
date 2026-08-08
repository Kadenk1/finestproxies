import { z } from "zod";

export const systemSettingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .max(120)
    .regex(/^[a-z0-9_.-]+$/, "Lowercase letters, numbers, dots, dashes, underscores only"),
  value: z.string().trim().min(1, "Value is required").max(4000),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export type SystemSettingInput = z.infer<typeof systemSettingSchema>;
