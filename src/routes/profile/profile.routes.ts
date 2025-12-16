import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  ProfileResponseSchema,
  UpdateProfileSchema,
} from "@/routes/profile/profile.schema";

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
          ...(statusCode === UNPROCESSABLE_ENTITY && { error: z.any() }),
        }),
      },
    },
  };
}

function getDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    [OK]: "Success",
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [NOT_FOUND]: "Resource not found",
    [UNPROCESSABLE_ENTITY]: "Validation error",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

const commonErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

const profileErrorResponses = {
  ...commonErrorResponses,
  [NOT_FOUND]: createResponse(NOT_FOUND),
};

/**
 * GET /profile - Get user profile
 */
export const getProfile = createRoute({
  method: "get" as const,
  path: "/profile",
  tags: ["Profile"],
  summary: "Get user profile",
  description: "Retrieve the complete profile for the authenticated user",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, ProfileResponseSchema),
    ...profileErrorResponses,
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
  description:
    "Update profile fields (partial updates allowed). Accepts different fields based on user type (candidate/unit)",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateProfileSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, UpdateProfileSchema),
    ...commonErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

export type GetProfile = typeof getProfile;
export type UpdateProfile = typeof updateProfile;
