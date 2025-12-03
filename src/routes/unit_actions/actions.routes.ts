import { z } from "zod";

// actions.routes.ts
import { createRouter } from "@/lib/create-app";
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./actions.handlers";

const router = createRouter();

// ============================================================================
// SCHEMAS
// ============================================================================

const ApplicationStatusEnum = z.enum([
  "applied",
  "shortlisted",
  "rejected",
  "interviewed",
  "hired",
]);

const CandidateOfferDecisionEnum = z.enum(["accept", "reject", "pending"]);

const ApplicationResponseSchema = z.object({
  application: z.object({
    id: z.string(),
    status: ApplicationStatusEnum,
    profileScore: z.number().nullable(),
    candidateOfferDecision: CandidateOfferDecisionEnum,
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
  }),
  internship: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string().nullable(),
    duration: z.string().nullable(),
  }),
  candidate: z.object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    type: z.string().nullable(),
    location: z.string().nullable(),
    phone: z.string().nullable(),
    skills: z.array(z.string()).nullable(),
    experienceLevel: z.string().nullable(),
    profileSummary: z.string().optional().nullable(),
  }),
});

const UpdateApplicationStatusSchema = z.object({
  applicationId: z.uuid(),
  status: ApplicationStatusEnum,
  interviewDetails: z
    .object({
      scheduledAt: z
        .string()
        .datetime()
        .optional()
        .describe("ISO 8601 datetime for interview"),
      meetingLink: z.string().url().optional().describe("Zoom or meeting link"),
      description: z.string().optional().describe("Additional notes"),
    })
    .optional()
    .describe("Required when status is 'interviewed'"),
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
// MIDDLEWARE
// ============================================================================

router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /applications - Get all applications for unit's internships
 */
router.openapi(
  {
    method: "get",
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
  },
  handlers.getUnitApplications,
);

/**
 * PUT /applications/status - Update application status
 */
router.openapi(
  {
    method: "put",
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
      [OK]: createResponse(
        OK,
        z.object({
          application: z.object({
            id: z.string(),
            status: ApplicationStatusEnum,
            updatedAt: z.string().or(z.date()),
          }),
          notificationSent: z.boolean(),
          emailSent: z.boolean(),
        }),
      ),
      [BAD_REQUEST]: createResponse(BAD_REQUEST),
      ...applicationCrudErrorResponses,
    },
  },
  handlers.updateApplicationStatus,
);

export default router;
