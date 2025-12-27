import { z } from "zod";

// Request Schemas
export const changeEmailRequestSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(1),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

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
export type ChangeEmailRequest = z.infer<typeof changeEmailRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type ChangePhoneRequest = z.infer<typeof changePhoneRequestSchema>;
export type NotificationsRequest = z.infer<typeof notificationsRequestSchema>;
export type DisabilityRequest = z.infer<typeof disabilityRequestSchema>;
