import { z } from "zod";

// notification.routes.ts
import { createRouter } from "@/lib/create-app";
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./notification.handlers";

const router = createRouter();

// ============================================================================
// SCHEMAS
// ============================================================================

const NotificationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  type: z.enum(["success", "info", "warning", "error"]),
  isRead: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

const NotificationIdParamSchema = z.object({
  id: z.uuid().describe("Notification ID"),
});

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
// MIDDLEWARE
// ============================================================================

router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET / - Get all user notifications
 */
router.openapi(
  {
    method: "get",
    path: "/",
    tags: ["Notifications"],
    summary: "Get user notifications",
    description:
      "Returns all notifications for the authenticated user (both candidates and units), ordered by creation date",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createResponse(
        OK,
        z.object({
          notifications: z.array(NotificationSchema),
          total: z.number(),
          unreadCount: z.number(),
        }),
      ),
      ...baseErrorResponses,
    },
  },
  handlers.getUserNotifications,
);

/**
 * PUT /:id/mark-read - Mark single notification as read
 */
router.openapi(
  {
    method: "put",
    path: "/{id}/mark-read",
    tags: ["Notifications"],
    summary: "Mark notification as read",
    description:
      "Marks a specific notification as read for the authenticated user",
    security: [{ Bearer: [] }],
    request: {
      params: NotificationIdParamSchema,
    },
    responses: {
      [OK]: createResponse(OK, NotificationSchema),
      ...notificationCrudErrorResponses,
    },
  },
  handlers.markNotificationAsRead,
);

/**
 * PUT /mark-all-read - Mark all notifications as read
 */
router.openapi(
  {
    method: "put",
    path: "/mark-all-read",
    tags: ["Notifications"],
    summary: "Mark all notifications as read",
    description: "Marks all notifications as read for the authenticated user",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createResponse(
        OK,
        z.object({
          updatedCount: z.number(),
        }),
      ),
      ...baseErrorResponses,
    },
  },
  handlers.markAllNotificationsAsRead,
);

/**
 * DELETE /:id - Delete single notification
 */
router.openapi(
  {
    method: "delete",
    path: "/{id}",
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
  },
  handlers.deleteNotification,
);

/**
 * DELETE / - Delete all notifications
 */
router.openapi(
  {
    method: "delete",
    path: "/",
    tags: ["Notifications"],
    summary: "Delete all notifications",
    description:
      "Deletes all notifications for the authenticated user. Each user can only delete their own notifications.",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createResponse(
        OK,
        z.object({
          deletedCount: z.number(),
        }),
      ),
      ...baseErrorResponses,
    },
  },
  handlers.deleteAllNotifications,
);

export default router;
