import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  BAD_REQUEST,
  CONFLICT,
  CREATED,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";

import {
  ApplicationResponseSchema,
  ApplicationStatusItemSchema,
  AppliedInternshipListItemSchema,
  ApplyToInternshipSchema,
  CountsResponseSchema,
  InternshipIdParamSchema,
  RemoveSavedInternshipSchema,
  SavedInternshipListItemSchema,
  SavedInternshipResponseSchema,
  SaveInternshipSchema,
  ShareLinksResponseSchema,
} from "./action.schema";

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
    [CREATED]: "Resource created successfully",
    [BAD_REQUEST]: "Bad request",
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [FORBIDDEN]: "Forbidden - Candidates only",
    [NOT_FOUND]: "Resource not found",
    [CONFLICT]: "Conflict - Resource already exists",
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
 * POST /internship/save - Save an internship
 */
export const saveInternship = createRoute({
  method: "post" as const,
  path: "/internship/save",
  tags: ["InternshipActions"],
  summary: "Save an internship",
  description: "Save an internship for later viewing (candidates only)",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SaveInternshipSchema,
        },
      },
    },
  },
  responses: {
    [CREATED]: createResponse(CREATED, SavedInternshipResponseSchema),
    [OK]: createResponse(OK),
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    ...commonErrorResponses,
  },
});

/**
 * DELETE /internship/save - Remove saved internship
 */
export const removeSavedInternship = createRoute({
  method: "delete" as const,
  path: "/internship/save",
  tags: ["InternshipActions"],
  summary: "Remove saved internship",
  description: "Remove an internship from saved list (candidates only)",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: RemoveSavedInternshipSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK),
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    ...commonErrorResponses,
  },
});

/**
 * POST /internship/apply - Apply to an internship
 */
export const applyToInternship = createRoute({
  method: "post" as const,
  path: "/internship/apply",
  tags: ["InternshipActions"],
  summary: "Apply to an internship",
  description:
    "Submit an application to an internship with optional profile sections (candidates only)",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ApplyToInternshipSchema,
        },
      },
    },
  },
  responses: {
    [CREATED]: createResponse(CREATED, ApplicationResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [CONFLICT]: createResponse(CONFLICT),
    ...commonErrorResponses,
  },
});

/**
 * GET /internship/saved - Get saved internships
 */
export const getSavedInternships = createRoute({
  method: "get" as const,
  path: "/internship/saved",
  tags: ["InternshipActions"],
  summary: "Get saved internships",
  description:
    "Retrieve list of internships saved by the candidate (candidates only)",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, z.array(SavedInternshipListItemSchema)),
    ...commonErrorResponses,
  },
});

/**
 * GET /internship/applied - Get applied internships
 */
export const getAppliedInternships = createRoute({
  method: "get" as const,
  path: "/internship/applied",
  tags: ["InternshipActions"],
  summary: "Get applied internships",
  description:
    "Retrieve list of internships the candidate has applied to (candidates only)",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, z.array(AppliedInternshipListItemSchema)),
    ...commonErrorResponses,
  },
});

/**
 * GET /internship/counts - Get counts
 */
export const getCounts = createRoute({
  method: "get" as const,
  path: "/internship/counts",
  tags: ["InternshipActions"],
  summary: "Get saved and applied counts",
  description:
    "Get count of saved and applied internships for the candidate (candidates only)",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, CountsResponseSchema),
    ...commonErrorResponses,
  },
});

/**
 * GET /internship/share/:id - Generate share links
 */
export const shareInternship = createRoute({
  method: "get" as const,
  path: "/internship/share/{id}",
  tags: ["InternshipActions"],
  summary: "Generate share links for an internship",
  description: "Generate social media share links for a specific internship",
  security: [{ Bearer: [] }],
  request: {
    params: InternshipIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, ShareLinksResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    ...commonErrorResponses,
  },
});

/**
 * GET /internship/application-status - Get application status
 */
export const getApplicationStatus = createRoute({
  method: "get" as const,
  path: "/internship/application-status",
  tags: ["InternshipActions"],
  summary: "Get application status with unit details",
  description:
    "Retrieve application status with internship and unit information (candidates only)",
  security: [{ Bearer: [] }],
  responses: {
    [OK]: createResponse(OK, z.array(ApplicationStatusItemSchema)),
    ...commonErrorResponses,
  },
});

export type SaveInternship = typeof saveInternship;
export type RemoveSavedInternship = typeof removeSavedInternship;
export type ApplyToInternship = typeof applyToInternship;
export type GetSavedInternships = typeof getSavedInternships;
export type GetAppliedInternships = typeof getAppliedInternships;
export type GetCounts = typeof getCounts;
export type ShareInternship = typeof shareInternship;
export type GetApplicationStatus = typeof getApplicationStatus;
