import { z } from "zod";

export const changePhoneRequestSchema = z.object({
  phone: z.string().min(6),
});

export const notificationsRequestSchema = z
  .object({
    emailNotificationsEnabled: z.boolean().optional(),
    inAppNotificationsEnabled: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.emailNotificationsEnabled !== undefined ||
      v.inAppNotificationsEnabled !== undefined,
    {
      message: "At least one notification setting must be provided",
    },
  );

export const disabilityRequestSchema = z.object({
  isDifferentlyAbled: z.boolean(),
});

// Type exports
export type ChangePhoneRequest = z.infer<typeof changePhoneRequestSchema>;
export type NotificationsRequest = z.infer<typeof notificationsRequestSchema>;
export type DisabilityRequest = z.infer<typeof disabilityRequestSchema>;
