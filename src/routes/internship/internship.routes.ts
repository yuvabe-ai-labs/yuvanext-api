import { z } from "zod";

// internship.routes.ts
import { createRouter } from "@/lib/create-app";
import {
  CREATED,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./internship.handlers";

const router = createRouter();

// ============================================================================
// SCHEMAS
// ============================================================================

const InternshipBaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.string().optional(),
  payment: z.string().optional(),
  status: z.enum(["active", "closed", "draft"]),
  closingDate: z.string().optional(),
  isPaid: z.boolean(),
  minAgeRequired: z.string().optional(),
  jobType: z.enum(["part_time", "full_time", "both"]).optional(),
  benefits: z.array(z.string()).optional(),
  skillsRequired: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
});

const CreateInternshipSchema = InternshipBaseSchema.extend({
  status: z.enum(["active", "closed", "draft"]).default("draft"),
  isPaid: z.boolean().default(false),
});

const UpdateInternshipSchema = InternshipBaseSchema.partial();

const InternshipIdParamSchema = z.object({
  id: z.uuid(),
});

// ============================================================================
// RESPONSE SCHEMAS
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
// MIDDLEWARE
// ============================================================================

router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /internships - List internships (role-based filtering)
 */
router.openapi(
  {
    method: "get",
    path: "/internships",
    tags: ["Internships"],
    summary: "List internships with role-based filtering",
    description:
      "Candidates see active internships, units see their created internships",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createSuccessResponse(OK, z.array(z.any())),
      ...commonErrorResponses,
    },
  },
  handlers.getInternships,
);

/**
 * GET /internships/recommended - Get AI-recommended internships
 */
router.openapi(
  {
    method: "get",
    path: "/internships/recommended",
    tags: ["Internships"],
    summary: "Get recommended internships based on candidate profile",
    description:
      "Returns personalized internship recommendations (candidates only)",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createSuccessResponse(
        OK,
        z.object({
          internships: z.array(z.any()),
          totalMatches: z.number(),
          profileKeywords: z.array(z.string()),
        }),
      ),
      ...commonErrorResponses,
      [NOT_FOUND]: createErrorResponse(NOT_FOUND),
    },
  },
  handlers.getRecommendedInternships,
);

/**
 * POST /internships - Create new internship
 */
router.openapi(
  {
    method: "post",
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
      [CREATED]: createSuccessResponse(CREATED, z.any()),
      ...commonErrorResponses,
      [UNPROCESSABLE_ENTITY]: createErrorResponse(UNPROCESSABLE_ENTITY),
    },
  },
  handlers.createInternship,
);

/**
 * GET /internships/:id - Get internship details
 */
router.openapi(
  {
    method: "get",
    path: "/internships/{id}",
    tags: ["Internships"],
    summary: "Get internship by ID",
    description: "Retrieve detailed information about a specific internship",
    security: [{ Bearer: [] }],
    request: {
      params: InternshipIdParamSchema,
    },
    responses: {
      [OK]: createSuccessResponse(OK, z.any()),
      ...commonCrudErrorResponses,
    },
  },
  handlers.getInternshipById,
);

/**
 * PUT /internships/:id - Update internship
 */
router.openapi(
  {
    method: "put",
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
      [OK]: createSuccessResponse(OK, z.any()),
      ...commonCrudErrorResponses,
    },
  },
  handlers.updateInternship,
);

/**
 * DELETE /internships/:id - Delete internship
 */
router.openapi(
  {
    method: "delete",
    path: "/internships/{id}",
    tags: ["Internships"],
    summary: "Delete internship posting",
    description:
      "Permanently delete an internship (units only, own internships)",
    security: [{ Bearer: [] }],
    request: {
      params: InternshipIdParamSchema,
    },
    responses: {
      [OK]: createSuccessResponse(OK),
      ...commonCrudErrorResponses,
    },
  },
  handlers.deleteInternship,
);

/**
 * GET /stats - Get unit statistics
 */
router.openapi(
  {
    method: "get",
    path: "/stats",
    tags: ["Internships"],
    summary: "Get unit dashboard statistics",
    description: "Retrieve aggregated statistics for the authenticated unit",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createSuccessResponse(
        OK,
        z.object({
          totalInternships: z.number(),
          totalApplications: z.number(),
          totalInterviews: z.number(),
          hiredThisMonth: z.number(),
          period: z.object({
            month: z.string(),
            year: z.number(),
          }),
        }),
      ),
      ...commonErrorResponses,
    },
  },
  handlers.getUnitStats,
);

export default router;
