import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  OK,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";

import { CourseResponseSchema } from "./course.schema";

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
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [FORBIDDEN]: "Forbidden - Candidates only",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

const commonErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [FORBIDDEN]: createResponse(FORBIDDEN),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /courses - List all courses
 */
export const getAllCourses = createRoute({
  method: "get" as const,
  path: "/courses",
  tags: ["Courses"],
  summary: "Get all courses",
  description:
    "Retrieve a list of all available courses with creator information (candidates only)",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, z.array(CourseResponseSchema)),
    ...commonErrorResponses,
  },
});

export type GetAllCourses = typeof getAllCourses;
