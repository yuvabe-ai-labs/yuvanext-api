import { createRoute } from "@hono/zod-openapi";

import {
  OK,
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
} from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  changePhoneRequestSchema,
  notificationsRequestSchema,
  disabilityRequestSchema,
} from "./settings.schema";

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * PATCH /settings/email - Change account email
 */
export const changeEmail = createRoute({
  method: "patch" as const,
  path: "/settings/email",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Change account email",
  description: "Change account email (requires current password verification)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: changeEmailRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  },
});

/**
 * PATCH /settings/password - Change account password
 */
export const changePassword = createRoute({
  method: "patch" as const,
  path: "/settings/password",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Change account password",
  description:
    "Change account password (requires current password verification)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: changePasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  },
});

/**
 * PATCH /settings/phone - Change phone number
 */
export const changePhone = createRoute({
  method: "patch" as const,
  path: "/settings/phone",
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
  path: "/settings/deactivate",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Deactivate account",
  description: "Deactivate account and remove all active sessions",
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
  },
});

/**
 * DELETE /settings - Delete account
 */
export const deleteAccount = createRoute({
  method: "delete" as const,
  path: "/settings",
  tags: ["Settings"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "admin"] }),
  summary: "Delete account",
  description: "Permanently delete account and all associated data",
  responses: {
    [OK]: createResponse(OK),
    ...restrictedErrorResponses,
  },
});

export type ChangeEmail = typeof changeEmail;
export type ChangePassword = typeof changePassword;
export type ChangePhone = typeof changePhone;
export type UpdateNotifications = typeof updateNotifications;
export type SetDisability = typeof setDisability;
export type DeactivateAccount = typeof deactivateAccount;
export type DeleteAccount = typeof deleteAccount;
