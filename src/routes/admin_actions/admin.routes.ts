import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
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

export type GetOverallStats = typeof getOverallStats;
export type GetCandidates = typeof getCandidates;
export type GetCandidateById = typeof getCandidateById;
export type GetUnits = typeof getUnits;
export type GetApplications = typeof getApplications;
export type GetUnitStats = typeof getUnitStats;
