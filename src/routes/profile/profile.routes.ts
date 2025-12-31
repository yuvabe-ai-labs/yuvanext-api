import { createRoute } from "@hono/zod-openapi";

import { NOT_FOUND, OK } from "@/lib/openapi/http-status-codes";
import {
  commonErrorResponses,
  createResponse,
  validationErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import { profileResponseSchema, updateProfileSchema } from "./profile.schema";

/**
 * GET /profile - Get user profile
 */
export const getProfile = createRoute({
  method: "get" as const,
  path: "/profile",
  tags: ["Profile"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Get user profile",
  description: "Retrieve the complete profile for the authenticated user",
  responses: {
    [OK]: createResponse(OK, profileResponseSchema),
    ...commonErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * PUT /profile - Update user profile
 */
export const updateProfile = createRoute({
  method: "put" as const,
  path: "/profile",
  tags: ["Profile"],
  summary: "Update user profile",
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  description:
    "Update profile fields (partial updates allowed). Accepts different fields based on user type (candidate/unit)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateProfileSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, updateProfileSchema),
    ...validationErrorResponses,
  },
});

export type GetProfile = typeof getProfile;
export type UpdateProfile = typeof updateProfile;
