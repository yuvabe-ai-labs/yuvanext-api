import { createRoute } from "@hono/zod-openapi";

import { OK, FORBIDDEN } from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  changePhoneRequestSchema,
  notificationsRequestSchema,
  disabilityRequestSchema,
} from "./settings.schema";

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * PATCH /settings/phone - Change phone number
 */
export const changePhone = createRoute({
  method: "patch" as const,
  path: "/settings/change-phone",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Change phone number",
  description: "Change phone number for candidate or unit profile",
  request: {
    body: {
      content: {
        "application/json": {
          schema: changePhoneRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
    [FORBIDDEN]: createResponse(FORBIDDEN),
  },
});

/**
 * PATCH /settings/notifications - Update notification preferences
 */
export const updateNotifications = createRoute({
  method: "patch" as const,
  path: "/settings/notifications",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Update notification preferences",
  description: "Update email and in-app notification settings",
  request: {
    body: {
      content: {
        "application/json": {
          schema: notificationsRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
  },
});

/**
 * PATCH /settings/disability - Set disability status
 */
export const setDisability = createRoute({
  method: "patch" as const,
  path: "/settings/disability",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "admin"] }),
  summary: "Set disability status",
  description: "Update disability status flag for candidate profile",
  request: {
    body: {
      content: {
        "application/json": {
          schema: disabilityRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
  },
});

/**
 * POST /settings/deactivate - Deactivate account
 */
export const deactivateAccount = createRoute({
  method: "post" as const,
  path: "/settings/account-deactivate",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Deactivate account",
  description: "Deactivate account and remove all active sessions",
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
  },
});

// get the setting notifications from db for a user
export const getNotificationSettings = createRoute({
  method: "get" as const,
  path: "/settings/notifications",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Get notification preferences",
  description: "Retrieve email and in-app notification settings",
  responses: {
    [OK]: createResponse(OK, notificationsRequestSchema),
    ...restrictedErrorResponses,
  },
});

export type ChangePhone = typeof changePhone;
export type UpdateNotifications = typeof updateNotifications;
export type SetDisability = typeof setDisability;
export type DeactivateAccount = typeof deactivateAccount;
export type GetNotificationSettings = typeof getNotificationSettings;
