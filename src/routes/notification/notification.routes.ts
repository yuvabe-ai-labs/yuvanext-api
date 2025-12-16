import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";

import {
  DeleteAllResponseSchema,
  GetNotificationsResponseSchema,
  MarkAllReadResponseSchema,
  NotificationIdParamSchema,
  NotificationResponseSchema,
} from "./notification.schema";

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function createResponse(statusCode: number, dataSchema?: z.ZodTypeAny) {
  return {
    description: getDescription(statusCode),
    content: {
      "application/json": {
        schema: z.object({
          status_code: z.literal(statusCode),
          message: z.string(),
          ...(dataSchema && { data: dataSchema }),
        }),
      },
    },
  };
}

function getDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    [OK]: "Success",
    [BAD_REQUEST]: "Invalid request parameters",
    [UNAUTHORIZED]: "Unauthorized - User not authenticated",
    [FORBIDDEN]: "Forbidden - Insufficient permissions",
    [NOT_FOUND]: "Resource not found",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

// Common error response sets
const baseErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

const notificationCrudErrorResponses = {
  ...baseErrorResponses,
  [BAD_REQUEST]: createResponse(BAD_REQUEST),
  [FORBIDDEN]: createResponse(FORBIDDEN),
  [NOT_FOUND]: createResponse(NOT_FOUND),
};

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /notifications - Get all user notifications
 */
export const getUserNotifications = createRoute({
  method: "get" as const,
  path: "/notifications",
  tags: ["Notifications"],
  summary: "Get user notifications",
  description:
    "Returns all notifications for the authenticated user (both candidates and units), ordered by creation date",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, GetNotificationsResponseSchema),
    ...baseErrorResponses,
  },
});

/**
 * PUT /notifications/:id/mark-read - Mark single notification as read
 */
export const markNotificationAsRead = createRoute({
  method: "put" as const,
  path: "/notifications/{id}/mark-read",
  tags: ["Notifications"],
  summary: "Mark notification as read",
  description:
    "Marks a specific notification as read for the authenticated user",
  security: [{ Bearer: [] }],
  request: {
    params: NotificationIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, NotificationResponseSchema),
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
  summary: "Mark all notifications as read",
  description: "Marks all notifications as read for the authenticated user",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, MarkAllReadResponseSchema),
    ...baseErrorResponses,
  },
});

/**
 * DELETE /notifications/:id - Delete single notification
 */
export const deleteNotification = createRoute({
  method: "delete" as const,
  path: "/notifications/{id}",
  tags: ["Notifications"],
  summary: "Delete notification",
  description:
    "Deletes a specific notification. Users can only delete their own notifications.",
  security: [{ Bearer: [] }],
  request: {
    params: NotificationIdParamSchema,
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
  summary: "Delete all notifications",
  description:
    "Deletes all notifications for the authenticated user. Each user can only delete their own notifications.",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, DeleteAllResponseSchema),
    ...baseErrorResponses,
  },
});

export type GetUserNotifications = typeof getUserNotifications;
export type MarkNotificationAsRead = typeof markNotificationAsRead;
export type MarkAllNotificationsAsRead = typeof markAllNotificationsAsRead;
export type DeleteNotification = typeof deleteNotification;
export type DeleteAllNotifications = typeof deleteAllNotifications;
