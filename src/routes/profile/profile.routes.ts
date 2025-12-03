import { z } from "zod";

// profile.routes.ts
import { createRouter } from "@/lib/create-app";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./profile.handlers";

const router = createRouter();

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Flexible update schema: allows partial profile updates with any shape
 * This enables different profile types (candidate, unit) to send relevant fields
 */
const UpdateProfileSchema = z.object({}).catchall(z.any());

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

// ============================================================================
// MIDDLEWARE
// ============================================================================

router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /profile - Get user profile
 */
router.openapi(
  {
    method: "get",
    path: "/profile",
    tags: ["Profile"],
    summary: "Get user profile",
    description: "Retrieve the complete profile for the authenticated user",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createResponse(OK, z.any()),
      ...profileErrorResponses,
    },
  },
  handlers.getProfile,
);

/**
 * PUT /profile - Update user profile
 */
router.openapi(
  {
    method: "put",
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
      [OK]: createResponse(
        OK,
        z.object({
          profileSummary: z.string(),
        }),
      ),
      ...commonErrorResponses,
      [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
    },
  },
  handlers.updateProfile,
);

/**
 * GET /profile/completion-percentage - Get profile completion status
 */
router.openapi(
  {
    method: "get",
    path: "/profile/completion-percentage",
    tags: ["Profile"],
    summary: "Get profile completion percentage",
    description:
      "Calculate and return the profile completion percentage based on filled fields",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createResponse(
        OK,
        z.object({
          completionPercentage: z.number(),
        }),
      ),
      ...commonErrorResponses,
    },
  },
  handlers.getCompletionPercentage,
);

export default router;
