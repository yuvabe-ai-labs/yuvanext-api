import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  CREATED,
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  resourceErrorResponses,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  createInternshipSchema,
  internshipIdParamSchema,
  internshipResponseSchema,
  recommendedInternshipsDataSchema,
  unitStatsResponseSchema,
  updateInternshipSchema,
} from "./internship.schema";

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * GET /internships - List internships (role-based filtering)
 */
export const getInternships = createRoute({
  method: "get" as const,
  path: "/internships",
  tags: ["Internships"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "List internships with role-based filtering",
  description:
    "Candidates see active internships, units see their created internships",
  responses: {
    [OK]: createResponse(OK, z.array(internshipResponseSchema)),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /internships/recommended - Get AI-recommended internships
 */
export const getRecommendedInternships = createRoute({
  method: "get" as const,
  path: "/internships/recommended",
  tags: ["Internships"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get recommended internships based on candidate profile",
  description:
    "Returns personalized internship recommendations (candidates only)",
  responses: {
    [OK]: createResponse(OK, recommendedInternshipsDataSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * POST /internships - Create new internship
 */
export const createInternship = createRoute({
  method: "post" as const,
  path: "/internships",
  tags: ["Internships"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Create new internship posting",
  description: "Create a new internship (units only)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createInternshipSchema,
        },
      },
    },
  },
  responses: {
    [CREATED]: createResponse(CREATED, internshipResponseSchema),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /internships/:id - Get internship details
 */
export const getInternshipById = createRoute({
  method: "get" as const,
  path: "/internships/{id}",
  tags: ["Internships"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Get internship by ID",
  description: "Retrieve detailed information about a specific internship",
  request: {
    params: internshipIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, internshipResponseSchema),
    ...resourceErrorResponses,
  },
});

/**
 * PUT /internships/:id - Update internship
 */
export const updateInternship = createRoute({
  method: "put" as const,
  path: "/internships/{id}",
  tags: ["Internships"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Update internship posting",
  description: "Update an existing internship (units only, own internships)",
  request: {
    params: internshipIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateInternshipSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, internshipResponseSchema),
    ...resourceErrorResponses,
  },
});

/**
 * DELETE /internships/:id - Delete internship
 */
export const deleteInternship = createRoute({
  method: "delete" as const,
  path: "/internships/{id}",
  tags: ["Internships"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Delete internship posting",
  description: "Permanently delete an internship (units only, own internships)",
  request: {
    params: internshipIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK),
    ...resourceErrorResponses,
  },
});

/**
 * GET /stats - Get unit statistics
 */
export const getUnitStats = createRoute({
  method: "get" as const,
  path: "/internships/stats",
  tags: ["Internships"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Get unit dashboard statistics",
  description: "Retrieve aggregated statistics for the authenticated unit",
  responses: {
    [OK]: createResponse(OK, unitStatsResponseSchema),
    ...restrictedErrorResponses,
  },
});

export type GetInternships = typeof getInternships;
export type GetRecommendedInternships = typeof getRecommendedInternships;
export type CreateInternship = typeof createInternship;
export type GetInternshipById = typeof getInternshipById;
export type UpdateInternship = typeof updateInternship;
export type DeleteInternship = typeof deleteInternship;
export type GetUnitStats = typeof getUnitStats;
