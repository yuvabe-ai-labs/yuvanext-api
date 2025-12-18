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
  applicationResponseSchema,
  applicationStatusItemSchema,
  appliedInternshipListItemSchema,
  applyToInternshipIdSchema,
  applyToInternshipSchema,
  countsResponseSchema,
  internshipIdParamSchema,
  removeSavedInternshipSchema,
  savedInternshipListItemSchema,
  savedinternshipResponseSchema,
  saveInternshipSchema,
  shareLinksResponseSchema,
} from "./action.schema";

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /internship/save - Get saved internships
 */
export const getSavedInternships = createRoute({
  method: "get" as const,
  path: "/candidate/internship/save",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get saved internships",
  description:
    "Retrieve list of internships saved by the candidate (candidates only)",
  responses: {
    [OK]: createResponse(OK, z.array(savedInternshipListItemSchema)),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /internship/apply - Get applied internships
 */
export const getAppliedInternships = createRoute({
  method: "get" as const,
  path: "/candidate/internship/apply",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get applied internships",
  description:
    "Retrieve list of internships the candidate has applied to (candidates only)",
  responses: {
    [OK]: createResponse(OK, z.array(appliedInternshipListItemSchema)),
    ...restrictedErrorResponses,
  },
});

/**
 * POST /internship/save - Save an internship
 */
export const saveInternship = createRoute({
  method: "post" as const,
  path: "/candidate/internship/:internshipId/save",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Save an internship",
  description: "Save an internship for later viewing (candidates only)",
  request: {
    params: saveInternshipSchema,
  },
  responses: {
    [CREATED]: createResponse(CREATED, savedinternshipResponseSchema),
    [OK]: createResponse(OK),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    ...restrictedErrorResponses,
  },
});

/**
 * DELETE /internship/save - Remove saved internship
 */
export const removeSavedInternship = createRoute({
  method: "delete" as const,
  path: "/candidate/internship/:internshipId/save",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Remove saved internship",
  description: "Remove an internship from saved list (candidates only)",
  request: {
    params: removeSavedInternshipSchema,
  },
  responses: {
    [OK]: createResponse(OK),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    ...restrictedErrorResponses,
  },
});

/**
 * POST /internship/apply - Apply to an internship
 */
export const applyToInternship = createRoute({
  method: "post" as const,
  path: "/candidate/internship/:internshipId/apply",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Apply to an internship",
  description:
    "Submit an application to an internship with optional profile sections (candidates only)",
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
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [CONFLICT]: createResponse(CONFLICT),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /internship/counts - Get counts
 */
export const getCounts = createRoute({
  method: "get" as const,
  path: "/candidate/internship/counts",
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  tags: ["InternshipActions"],
  summary: "Get saved and applied counts",
  description:
    "Get count of saved and applied internships for the candidate (candidates only)",
  responses: {
    [OK]: createResponse(OK, countsResponseSchema),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /internship/share/:id - Generate share links
 */
export const shareInternship = createRoute({
  method: "get" as const,
  path: "/candidate/internship/share/{id}",
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  tags: ["InternshipActions"],
  summary: "Generate share links for an internship",
  description: "Generate social media share links for a specific internship",
  request: {
    params: internshipIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, shareLinksResponseSchema),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /internship/application-status - Get application status
 */
export const getApplicationStatus = createRoute({
  method: "get" as const,
  path: "/candidate/internship/application-status",
  tags: ["InternshipActions"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get application status with unit details",
  description:
    "Retrieve application status with internship and unit information (candidates only)",
  responses: {
    [OK]: createResponse(OK, z.array(applicationStatusItemSchema)),
    ...restrictedErrorResponses,
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
