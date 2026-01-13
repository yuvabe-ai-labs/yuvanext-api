import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  NOT_FOUND,
  OK,
  CREATED,
  BAD_REQUEST,
  CONFLICT,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  candidateIdParamSchema,
  candidateQuerySchema,
  unitQuerySchema,
  applicationQuerySchema,
  overallStatsResponseSchema,
  recentCandidateSchema,
  recentUnitSchema,
  activeUnitWithStatsSchema,
  recentAppliedCandidateSchema,
  appliedCandidateSchema,
  hiredCandidateSchema,
  interviewScheduledCandidateSchema,
  shortlistedCandidateSchema,
  unitRegistrationStatsSchema,
  createPaginatedResponseSchema,
  candidateFullResponseSchema,
  addCompanyRequestSchema,
  addCompanyResponseSchema,
  deactivateUnitParamSchema,
  deactivateUnitResponseSchema,
  candidateAndUnitForAdminSchema,
  internshipForAdminSchema,
  getAllInternshipsQuerySchema,
  disableInternshipResponseSchema,
  enableInternshipResponseSchema,
} from "./admin.schema";

// 1. GET /admin/stats/overview - Overall Statistics
export const getOverallStats = createRoute({
  method: "get" as const,
  path: "/admin/stats/overview",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get overall system statistics",
  description:
    "Retrieve counts of units, candidates, internships, courses, and hired candidates",
  responses: {
    [OK]: createResponse(OK, overallStatsResponseSchema),
    ...restrictedErrorResponses,
  },
});

// 2. GET /admin/candidates?filter=recent - Get Recent 10 Candidates
export const getCandidates = createRoute({
  method: "get" as const,
  path: "/admin/candidates",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get candidates with filters",
  description:
    "Get candidates based on filter: recent (10), all, applied, hired, or shortlisted with pagination",
  request: {
    query: candidateQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.union([
        z.array(recentCandidateSchema),
        createPaginatedResponseSchema(appliedCandidateSchema),
        createPaginatedResponseSchema(hiredCandidateSchema),
        createPaginatedResponseSchema(shortlistedCandidateSchema),
      ]),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// 3. GET /admin/candidates/:id - Get Candidate Details by ID
export const getCandidateById = createRoute({
  method: "get" as const,
  path: "/admin/candidates/{id}",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get candidate details by ID",
  description: "Retrieve full detailed information about a specific candidate",
  request: {
    params: candidateIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, candidateFullResponseSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// 4. GET /admin/units - Get Units with Filters
export const getUnits = createRoute({
  method: "get" as const,
  path: "/admin/units",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get units with filters",
  description:
    "Get units based on filter: recent (10 recent joined) or active (10 active with stats) or paginated active units",
  request: {
    query: unitQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.union([
        z.array(recentUnitSchema),
        z.array(activeUnitWithStatsSchema),
        createPaginatedResponseSchema(activeUnitWithStatsSchema),
      ]),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// 6. GET /admin/applications - Get Applications with Filters
export const getApplications = createRoute({
  method: "get" as const,
  path: "/admin/applications",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get applications with filters",
  description:
    "Get applications: recent (10 recent applied) or interview (scheduled interviews with pagination)",
  request: {
    query: applicationQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.union([
        z.array(recentAppliedCandidateSchema),
        createPaginatedResponseSchema(interviewScheduledCandidateSchema),
      ]),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// 12. GET /admin/stats/units - Unit Registration Statistics
export const getUnitStats = createRoute({
  method: "get" as const,
  path: "/admin/stats/units",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get unit registration statistics",
  description:
    "Get counts of total registered units, active units, active job posts, and total applications",
  responses: {
    [OK]: createResponse(OK, unitRegistrationStatsSchema),
    ...restrictedErrorResponses,
  },
});

// 13. POST /admin/units/add-company - Add Company/Unit by Admin
export const addCompany = createRoute({
  method: "post" as const,
  path: "/admin/units/add-company",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Add a new company/unit",
  description:
    "Admin can add a new company/unit with all details and send verification email",
  request: {
    body: {
      content: {
        "application/json": {
          schema: addCompanyRequestSchema,
        },
      },
    },
  },
  responses: {
    [CREATED]: createResponse(CREATED, addCompanyResponseSchema),
    ...restrictedErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [CONFLICT]: createResponse(CONFLICT),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// 14. PATCH /admin/units/:id/deactivate - Deactivate Unit by Admin
export const deactivateUnit = createRoute({
  method: "patch" as const,
  path: "/admin/units/{id}/deactivate",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Deactivate a unit",
  description:
    "Admin can deactivate a unit account and remove all active sessions",
  request: {
    params: deactivateUnitParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, deactivateUnitResponseSchema),
    ...restrictedErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

export const activateUnit = createRoute({
  method: "patch" as const,
  path: "/admin/units/{id}/activate",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Activate a unit",
  description: "Admin can activate a deactivated unit account",
  request: {
    params: deactivateUnitParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, deactivateUnitResponseSchema),
    ...restrictedErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

export const getAllCandidatesAndUnits = createRoute({
  method: "get" as const,
  path: "/admin/all",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get all candidates and units data for admin",
  description:
    "Retrieve all candidates and units data for administrative purposes",
  responses: {
    [OK]: createResponse(OK, candidateAndUnitForAdminSchema),
    ...restrictedErrorResponses,
  },
});

// 16. PATCH /admin/internships/:id/disable - Disable Internship by Admin
export const disableInternship = createRoute({
  method: "patch" as const,
  path: "/admin/internships/{id}/disable",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Disable an internship",
  description: "Admin can disable/close an internship posting",
  request: {
    params: z.object({
      id: z.uuid("Invalid internship ID"),
    }),
  },
  responses: {
    [OK]: createResponse(OK, disableInternshipResponseSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// 17. PATCH /admin/internships/:id/enable - Enable Internship by Admin
export const enableInternship = createRoute({
  method: "patch" as const,
  path: "/admin/internships/{id}/enable",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Enable an internship",
  description: "Admin can enable/reactivate a disabled internship posting",
  request: {
    params: z.object({
      id: z.string().uuid("Invalid internship ID"),
    }),
  },
  responses: {
    [OK]: createResponse(OK, enableInternshipResponseSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// 18. GET /admin/internships - Get All Internships with Pagination
export const getAllInternships = createRoute({
  method: "get" as const,
  path: "/admin/internships",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get all internships with pagination",
  description:
    "Retrieve all internships with pagination, sorted by creation date",
  request: {
    query: getAllInternshipsQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      createPaginatedResponseSchema(internshipForAdminSchema),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

export type GetOverallStats = typeof getOverallStats;
export type GetCandidates = typeof getCandidates;
export type GetCandidateById = typeof getCandidateById;
export type GetUnits = typeof getUnits;
export type GetApplications = typeof getApplications;
export type GetUnitStats = typeof getUnitStats;
export type AddCompany = typeof addCompany;
export type DeactivateUnit = typeof deactivateUnit;
export type ActivateUnit = typeof activateUnit;
export type GetAllCandidatesAndUnits = typeof getAllCandidatesAndUnits;
export type DisableInternship = typeof disableInternship;
export type EnableInternship = typeof enableInternship;
export type GetAllInternships = typeof getAllInternships;
