import { z } from "zod";

// course.routes.ts
import { createRouter } from "@/lib/create-app";
import {
  INTERNAL_SERVER_ERROR,
  OK,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./course.handlers";

const router = createRouter();

// ============================================================================
// SCHEMAS
// ============================================================================

const CourseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  category: z.string().nullable(),
  difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  createdBy: z.uuid(),
  bannerUrl: z.string().nullable(),
  redirectUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  creatorName: z.string().nullable(),
  creatorAvatarUrl: z.string().nullable(),
  creatorType: z.string().nullable(),
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
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

const commonErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /courses - List all courses
 */
router.openapi(
  {
    method: "get",
    path: "/courses",
    tags: ["Courses"],
    summary: "Get all courses",
    description:
      "Retrieve a list of all available courses with creator information",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createResponse(OK, z.array(CourseSchema)),
      ...commonErrorResponses,
    },
  },
  handlers.getAllCourses,
);

export default router;
