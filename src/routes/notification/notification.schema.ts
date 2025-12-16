import { z } from "zod";

// Enums
export const NotificationTypeEnum = z.enum([
  "success",
  "info",
  "warning",
  "error",
]);

// Request Schemas
export const NotificationIdParamSchema = z.object({
  id: z.uuid().describe("Notification ID"),
});

// Response Schemas
export const NotificationResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  type: NotificationTypeEnum,
  isRead: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const GetNotificationsResponseSchema = z.object({
  notifications: z.array(NotificationResponseSchema),
  total: z.number(),
  unreadCount: z.number(),
});

export const MarkAllReadResponseSchema = z.object({
  updatedCount: z.number(),
});

export const DeleteAllResponseSchema = z.object({
  deletedCount: z.number(),
});
