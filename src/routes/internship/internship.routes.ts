import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  CREATED,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";

import {
  CreateInternshipSchema,
  InternshipIdParamSchema,
  InternshipResponseSchema,
  RecommendedInternshipsDataSchema,
  UnitStatsResponseSchema,
  UpdateInternshipSchema,
} from "./internship.schema";

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function createSuccessResponse(statusCode: number, dataSchema?: z.ZodTypeAny) {
  return {
    description: getResponseDescription(statusCode),
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

function createErrorResponse(statusCode: number) {
  return {
    description: getResponseDescription(statusCode),
    content: {
      "application/json": {
        schema: z.object({
          status_code: z.literal(statusCode),
          message: z.string(),
          ...(statusCode === UNPROCESSABLE_ENTITY && { error: z.any() }),
        }),
      },
    },
  };
}

function getResponseDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    [OK]: "Success",
    [CREATED]: "Resource created successfully",
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [FORBIDDEN]: "Forbidden - Insufficient permissions",
    [NOT_FOUND]: "Resource not found",
    [UNPROCESSABLE_ENTITY]: "Validation error",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

const commonErrorResponses = {
  [UNAUTHORIZED]: createErrorResponse(UNAUTHORIZED),
  [FORBIDDEN]: createErrorResponse(FORBIDDEN),
  [INTERNAL_SERVER_ERROR]: createErrorResponse(INTERNAL_SERVER_ERROR),
};

const commonCrudErrorResponses = {
  ...commonErrorResponses,
  [NOT_FOUND]: createErrorResponse(NOT_FOUND),
  [UNPROCESSABLE_ENTITY]: createErrorResponse(UNPROCESSABLE_ENTITY),
};

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /internships - List internships (role-based filtering)
 */
export const getInternships = createRoute({
  method: "get" as const,
  path: "/internships",
  tags: ["Internships"],
  summary: "List internships with role-based filtering",
  description:
    "Candidates see active internships, units see their created internships",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createSuccessResponse(OK, z.array(InternshipResponseSchema)),
    ...commonErrorResponses,
  },
});

/**
 * GET /internships/recommended - Get AI-recommended internships
 */
export const getRecommendedInternships = createRoute({
  method: "get" as const,
  path: "/internships/recommended",
  tags: ["Internships"],
  summary: "Get recommended internships based on candidate profile",
  description:
    "Returns personalized internship recommendations (candidates only)",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createSuccessResponse(OK, RecommendedInternshipsDataSchema),
    ...commonErrorResponses,
    [NOT_FOUND]: createErrorResponse(NOT_FOUND),
  },
});

/**
 * POST /internships - Create new internship
 */
export const createInternship = createRoute({
  method: "post" as const,
  path: "/internships",
  tags: ["Internships"],
  summary: "Create new internship posting",
  description: "Create a new internship (units only)",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateInternshipSchema,
        },
      },
    },
  },
  responses: {
    [CREATED]: createSuccessResponse(CREATED, InternshipResponseSchema),
    ...commonErrorResponses,
    [UNPROCESSABLE_ENTITY]: createErrorResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /internships/:id - Get internship details
 */
export const getInternshipById = createRoute({
  method: "get" as const,
  path: "/internships/{id}",
  tags: ["Internships"],
  summary: "Get internship by ID",
  description: "Retrieve detailed information about a specific internship",
  security: [{ Bearer: [] }],
  request: {
    params: InternshipIdParamSchema,
  },
  responses: {
    [OK]: createSuccessResponse(OK, InternshipResponseSchema),
    ...commonCrudErrorResponses,
  },
});

/**
 * PUT /internships/:id - Update internship
 */
export const updateInternship = createRoute({
  method: "put" as const,
  path: "/internships/{id}",
  tags: ["Internships"],
  summary: "Update internship posting",
  description: "Update an existing internship (units only, own internships)",
  security: [{ Bearer: [] }],
  request: {
    params: InternshipIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateInternshipSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createSuccessResponse(OK, InternshipResponseSchema),
    ...commonCrudErrorResponses,
  },
});

/**
 * DELETE /internships/:id - Delete internship
 */
export const deleteInternship = createRoute({
  method: "delete" as const,
  path: "/internships/{id}",
  tags: ["Internships"],
  summary: "Delete internship posting",
  description: "Permanently delete an internship (units only, own internships)",
  security: [{ Bearer: [] }],
  request: {
    params: InternshipIdParamSchema,
  },
  responses: {
    [OK]: createSuccessResponse(OK),
    ...commonCrudErrorResponses,
  },
});

/**
 * GET /stats - Get unit statistics
 */
export const getUnitStats = createRoute({
  method: "get" as const,
  path: "/internships/stats",
  tags: ["Internships"],
  summary: "Get unit dashboard statistics",
  description: "Retrieve aggregated statistics for the authenticated unit",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createSuccessResponse(OK, UnitStatsResponseSchema),
    ...commonErrorResponses,
  },
});

export type GetInternships = typeof getInternships;
export type GetRecommendedInternships = typeof getRecommendedInternships;
export type CreateInternship = typeof createInternship;
export type GetInternshipById = typeof getInternshipById;
export type UpdateInternship = typeof updateInternship;
export type DeleteInternship = typeof deleteInternship;
export type GetUnitStats = typeof getUnitStats;
