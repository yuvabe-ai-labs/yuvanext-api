import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  CONFLICT,
  CREATED,
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  acceptOfferParamSchema,
  acceptOrRejectOfferSchema,
  acceptOfferResponseSchema,
  applicationResponseSchema,
  applicationStatusItemSchema,
  applyToInternshipIdSchema,
  applyToInternshipSchema,
  countsResponseSchema,
  errorResponseSchema,
  internshipIdParamSchema,
  sortQuerySchema,
  removeSavedInternshipSchema,
  saveInternshipSchema,
  shareLinksResponseSchema,
  savedInternshipsListSchema,
  appliedInternshipsListSchema,
} from "./action.schema";

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /candidate/internship/save - Get saved internships
 */
export const getSavedInternships = createRoute({
  method: "get" as const,
  path: "/candidate/internship/save",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get all saved internships",
  description: `
    Retrieve all internships saved by the candidate.
    
  `,
  request: {
    query: sortQuerySchema,
  },
  responses: {
    [OK]: createResponse(OK, savedInternshipsListSchema),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /candidate/internship/apply - Get applied internships
 */
export const getAppliedInternships = createRoute({
  method: "get" as const,
  path: "/candidate/internship/apply",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get all applied internships",
  description: `Retrieve all internships the candidate has applied to.`,
  request: {
    query: sortQuerySchema,
  },
  responses: {
    [OK]: createResponse(OK, appliedInternshipsListSchema),
    ...restrictedErrorResponses,
  },
});

/**
 * POST /candidate/internship/:internshipId/save - Save an internship
 */
export const saveInternship = createRoute({
  method: "post",
  path: "/candidate/internship/:internshipId/save",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Save an internship",
  description: "Save an internship for later viewing.",
  request: {
    params: saveInternshipSchema,
  },
  responses: {
    [CREATED]: createResponse(CREATED, z.object({ message: z.string() })),
    [CONFLICT]: createResponse(CONFLICT, z.object({ message: z.string() })),
    [NOT_FOUND]: createResponse(NOT_FOUND, errorResponseSchema),
    [UNPROCESSABLE_ENTITY]: createResponse(
      UNPROCESSABLE_ENTITY,
      errorResponseSchema,
    ),
    ...restrictedErrorResponses,
  },
});

/**
 * DELETE /candidate/internship/:internshipId/save - Remove saved internship
 */
export const removeSavedInternship = createRoute({
  method: "delete" as const,
  path: "/candidate/internship/:internshipId/save",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Remove saved internship",
  description: `
    Remove an internship from saved list.
    
    - Requires candidate role
    - Returns 404 if internship wasn't previously saved
    - Idempotent: Safe to call multiple times
    - Only removes the bookmark, doesn't affect applications
    
    Note: Removing a saved internship does NOT withdraw any existing application.
  `,
  request: {
    params: removeSavedInternshipSchema,
  },
  responses: {
    [OK]: createResponse(OK, z.object({ message: z.string() })),
    [NOT_FOUND]: createResponse(NOT_FOUND, errorResponseSchema),
    [UNPROCESSABLE_ENTITY]: createResponse(
      UNPROCESSABLE_ENTITY,
      errorResponseSchema,
    ),
    ...restrictedErrorResponses,
  },
});

/**
 * POST /candidate/internship/:internshipId/apply - Apply to an internship
 */
export const applyToInternship = createRoute({
  method: "post" as const,
  path: "/candidate/internship/:internshipId/apply",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Apply to an internship",
  description: `Submit an application to an internship with optional profile sections.`,
  request: {
    params: applyToInternshipIdSchema,
    body: {
      content: {
        "application/json": {
          schema: applyToInternshipSchema,
        },
      },
    },
  },
  responses: {
    [CREATED]: createResponse(CREATED, applicationResponseSchema),
    [NOT_FOUND]: createResponse(NOT_FOUND, errorResponseSchema),
    [CONFLICT]: createResponse(CONFLICT, errorResponseSchema),
    [UNPROCESSABLE_ENTITY]: createResponse(
      UNPROCESSABLE_ENTITY,
      errorResponseSchema,
    ),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /candidate/internship/counts - Get counts
 */
export const getCounts = createRoute({
  method: "get" as const,
  path: "/candidate/internship/counts",
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  tags: ["InternshipActions"],
  summary: "Get saved and applied counts",
  description: `
    Get total count of saved and applied internships for the candidate.`,
  responses: {
    [OK]: createResponse(OK, countsResponseSchema),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /candidate/internship/share/:id - Generate share links
 */
export const shareInternship = createRoute({
  method: "get" as const,
  path: "/candidate/internship/share/{id}",
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  tags: ["InternshipActions"],
  summary: "Generate share links for an internship",
  description: `Generate social media share links for a specific internship.`,
  request: {
    params: internshipIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, shareLinksResponseSchema),
    [NOT_FOUND]: createResponse(NOT_FOUND, errorResponseSchema),
    [UNPROCESSABLE_ENTITY]: createResponse(
      UNPROCESSABLE_ENTITY,
      errorResponseSchema,
    ),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /candidate/internship/application-status - Get application status
 */
export const getApplicationStatus = createRoute({
  method: "get" as const,
  path: "/candidate/internship/application-status",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get application status with unit details",
  description: `Retrieve all applications with their current status and unit information.`,
  responses: {
    [OK]: createResponse(OK, z.array(applicationStatusItemSchema)),
    ...restrictedErrorResponses,
  },
});

/**
 * POST /candidate/internship/application/:applicationId/accept-offer - Accept or reject internship offer
 */
export const acceptOffer = createRoute({
  method: "post" as const,
  path: "/candidate/internship/application/:applicationId/accept-offer",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Accept or reject internship offer",
  description: `Accept or reject an internship offer from a unit`,
  request: {
    params: acceptOfferParamSchema,
    body: {
      content: {
        "application/json": {
          schema: acceptOrRejectOfferSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, acceptOfferResponseSchema),
    [NOT_FOUND]: createResponse(NOT_FOUND, errorResponseSchema),
    [CONFLICT]: createResponse(CONFLICT, errorResponseSchema),
    [UNPROCESSABLE_ENTITY]: createResponse(
      UNPROCESSABLE_ENTITY,
      errorResponseSchema,
    ),
    ...restrictedErrorResponses,
  },
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SaveInternship = typeof saveInternship;
export type RemoveSavedInternship = typeof removeSavedInternship;
export type ApplyToInternship = typeof applyToInternship;
export type GetSavedInternships = typeof getSavedInternships;
export type GetAppliedInternships = typeof getAppliedInternships;
export type GetCounts = typeof getCounts;
export type ShareInternship = typeof shareInternship;
export type GetApplicationStatus = typeof getApplicationStatus;
export type AcceptOffer = typeof acceptOffer;
