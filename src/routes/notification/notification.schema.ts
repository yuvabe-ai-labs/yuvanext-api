import { z } from "zod";

// Enums
export const notificationTypeEnum = z.enum([
  "success",
  "info",
  "warning",
  "error",
]);

// Request Schemas
export const notificationIdParamSchema = z.object({
  id: z.uuid().describe("Notification ID"),
});

// Response Schemas
export const notificationResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  type: notificationTypeEnum,
  isRead: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const getNotificationsResponseSchema = z.object({
  notifications: z.array(notificationResponseSchema),
  total: z.number(),
  unreadCount: z.number(),
});

export const markAllReadResponseSchema = z.object({
  updatedCount: z.number(),
});

export const deleteAllResponseSchema = z.object({
  deletedCount: z.number(),
});
