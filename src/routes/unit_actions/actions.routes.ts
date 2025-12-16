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
  ApplicationResponseSchema,
  UpdateApplicationStatusResponseSchema,
  UpdateApplicationStatusSchema,
} from "./actions.shema";

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
          ...(statusCode === BAD_REQUEST && {
            errors: z.array(z.any()).optional(),
          }),
        }),
      },
    },
  };
}

function getDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    [OK]: "Success",
    [BAD_REQUEST]: "Invalid request data",
    [UNAUTHORIZED]: "Unauthorized - User not authenticated",
    [FORBIDDEN]: "Forbidden - Insufficient permissions",
    [NOT_FOUND]: "Resource not found",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

const commonErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [FORBIDDEN]: createResponse(FORBIDDEN),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

const applicationCrudErrorResponses = {
  ...commonErrorResponses,
  [NOT_FOUND]: createResponse(NOT_FOUND),
};

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /applications - Get all applications for unit's internships
 */
export const getApplications = createRoute({
  method: "get" as const,
  path: "/applications",
  tags: ["Unit Actions"],
  summary: "Get all applications for unit's internships",
  description:
    "Returns all applications submitted to internships posted by the unit, including candidate profile details and internship information",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, z.array(ApplicationResponseSchema)),
    ...applicationCrudErrorResponses,
  },
});

/**
 * PUT /applications/status - Update application status
 */
export const updateApplicationStatus = createRoute({
  method: "put" as const,
  path: "/applications/status",
  tags: ["Unit Actions"],
  summary: "Update application status",
  description:
    "Allows units to update the status of applications for their internships. Automatically sends notifications and emails to candidates based on the new status.",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateApplicationStatusSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, UpdateApplicationStatusResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    ...applicationCrudErrorResponses,
  },
});

export type GetApplications = typeof getApplications;
export type UpdateApplicationStatus = typeof updateApplicationStatus;
