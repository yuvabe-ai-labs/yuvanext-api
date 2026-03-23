import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { BAD_REQUEST, NOT_FOUND, OK } from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  applicationByInternshipResponseSchema,
  applicationResponseSchema,
  candidateProfileResponseSchema,
  detailedApplicationResponseSchema,
  updateApplicationStatusResponseSchema,
  updateApplicationStatusSchema,
} from "./actions.shema";

/**
 * GET /applications - Get all applications for unit's internships
 */
export const getApplications = createRoute({
  method: "get" as const,
  path: "/unit/applications",
  tags: ["Unit Actions"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Get all applications for unit's internships",
  description:
    "Returns all applications submitted to internships posted by the unit, including candidate profile details and internship information",
  responses: {
    [OK]: createResponse(OK, z.array(applicationResponseSchema)),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * GET /applications by id - Get specific applications for unit's internships
 */

export const getApplicationById = createRoute({
  method: "get" as const,
  path: "/unit/applications/:applicationId",
  tags: ["Unit Actions"],
  middleware: requireRole({ allowedRoles: ["unit", "admin", "mentor"] }),
  summary: "Get specific application for unit's internships",
  description:
    "Returns a specific application submitted to an internship posted by the unit, including candidate profile details and internship information",
  responses: {
    [OK]: createResponse(OK, detailedApplicationResponseSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * PUT /applications/status - Update application status
 */
export const updateApplicationStatus = createRoute({
  method: "put" as const,
  path: "/unit/applications/status",
  tags: ["Unit Actions"],
  summary: "Update application status",
  middleware: requireRole({ allowedRoles: ["unit"] }),
  description:
    "Allows units to update the status of applications for their internships. Automatically sends notifications and emails to candidates based on the new status.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateApplicationStatusSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, updateApplicationStatusResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * GET /applications/internship/:internshipId - Get all applications for a specific internship
 */
export const getApplicationsByInternshipId = createRoute({
  method: "get" as const,
  path: "/unit/applications/internship/:internshipId",
  tags: ["Unit Actions"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Get all applications for a specific internship",
  description:
    "Returns all applications submitted to a specific internship posted by the unit, including candidate basic info",
  responses: {
    [OK]: createResponse(OK, z.array(applicationByInternshipResponseSchema)),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * GET /candidates/:candidateId - Get candidate profile without application (for mentors)
 */
export const getCandidateProfileById = createRoute({
  method: "get" as const,
  path: "/mentor/candidates/:candidateId",
  tags: ["Unit Actions"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "Get candidate profile without application",
  description:
    "Returns a candidate's profile information directly without requiring an associated application. Only mentors can access this endpoint.",
  responses: {
    [OK]: createResponse(OK, candidateProfileResponseSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

export type GetApplicationsByInternshipId =
  typeof getApplicationsByInternshipId;
export type GetApplications = typeof getApplications;
export type UpdateApplicationStatus = typeof updateApplicationStatus;
export type GetApplicationById = typeof getApplicationById;
export type GetCandidateProfileById = typeof getCandidateProfileById;
