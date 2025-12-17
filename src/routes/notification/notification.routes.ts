import { createRoute } from "@hono/zod-openapi";

import {
  FORBIDDEN,
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  commonErrorResponses,
  createResponse,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  deleteAllResponseSchema,
  getNotificationsResponseSchema,
  markAllReadResponseSchema,
  notificationIdParamSchema,
  notificationResponseSchema,
} from "./notification.schema";

const notificationCrudErrorResponses = {
  ...commonErrorResponses,
  [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  [FORBIDDEN]: createResponse(FORBIDDEN),
  [NOT_FOUND]: createResponse(NOT_FOUND),
};

/**
 * GET /notifications - Get all user notifications
 */
export const getUserNotifications = createRoute({
  method: "get" as const,
  path: "/notifications",
  tags: ["Notifications"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Get user notifications",
  description:
    "Returns all notifications for the authenticated user (both candidates and units), ordered by creation date",
  responses: {
    [OK]: createResponse(OK, getNotificationsResponseSchema),
    ...commonErrorResponses,
  },
});

/**
 * PUT /notifications/:id/mark-read - Mark single notification as read
 */
export const markNotificationAsRead = createRoute({
  method: "put" as const,
  path: "/notifications/{id}/mark-read",
  tags: ["Notifications"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Mark notification as read",
  description:
    "Marks a specific notification as read for the authenticated user",
  request: {
    params: notificationIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, notificationResponseSchema),
    ...notificationCrudErrorResponses,
  },
});

/**
 * PUT /notifications/mark-all-read - Mark all notifications as read
 */
export const markAllNotificationsAsRead = createRoute({
  method: "put" as const,
  path: "/notifications/mark-all-read",
  tags: ["Notifications"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Mark all notifications as read",
  description: "Marks all notifications as read for the authenticated user",
  responses: {
    [OK]: createResponse(OK, markAllReadResponseSchema),
    ...commonErrorResponses,
  },
});

/**
 * DELETE /notifications/:id - Delete single notification
 */
export const deleteNotification = createRoute({
  method: "delete" as const,
  path: "/notifications/{id}",
  tags: ["Notifications"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Delete notification",
  description:
    "Deletes a specific notification. Users can only delete their own notifications.",
  request: {
    params: notificationIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK),
    ...notificationCrudErrorResponses,
  },
});

/**
 * DELETE /notifications - Delete all notifications
 */
export const deleteAllNotifications = createRoute({
  method: "delete" as const,
  path: "/notifications",
  tags: ["Notifications"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Delete all notifications",
  description:
    "Deletes all notifications for the authenticated user. Each user can only delete their own notifications.",
  responses: {
    [OK]: createResponse(OK, deleteAllResponseSchema),
    ...commonErrorResponses,
  },
});

export type GetUserNotifications = typeof getUserNotifications;
export type MarkNotificationAsRead = typeof markNotificationAsRead;
export type MarkAllNotificationsAsRead = typeof markAllNotificationsAsRead;
export type DeleteNotification = typeof deleteNotification;
export type DeleteAllNotifications = typeof deleteAllNotifications;
