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
import { createRoute, z } from "@hono/zod-openapi";
import { createPaginatedResponseSchema } from "../admin_actions/admin.schema";
import {
  getMentorCandidatesQuerySchema,
  mentorCandidateItemSchema,
  mentorUnitProfileSchema,
  getMentorUnitsQuerySchema,
  mentorUnitListItemSchema,
  mentorStatsResponseSchema,
} from "./view.schema";

/**
 * GET /mentor/candidates
 *
 * Mentor sees all candidates they have already ACCEPTED.
 * search → filter by candidate name
 */
export const getMentorAcceptedCandidates = createRoute({
  method: "get" as const,
  path: "/mentor/accepted-candidates",
  tags: ["Mentor view - Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "List accepted (active) candidates",
  description:
    "Returns a paginated list of candidates whose mentorship requests were " +
    "accepted by the authenticated mentor. " +
    "Supports search by candidate name.",
  request: {
    query: getMentorCandidatesQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      createPaginatedResponseSchema(mentorCandidateItemSchema),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /mentor/units
 *
 * Returns a paginated list of all unique units (companies) that the mentor's
 * accepted candidates have applied to, along with an applicationCount per unit.
 * search → filter by unit name
 */
export const getMentorUnits = createRoute({
  method: "get" as const,
  path: "/mentor/units",
  tags: ["Mentor view - Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "List all units from accepted candidates' applications",
  description:
    "Returns a paginated list of unique units (companies/organisations) that " +
    "any of the authenticated mentor's accepted candidates have applied to. " +
    "Each row includes a count of how many of those candidates applied to that unit. " +
    "Supports search by unit name.",
  request: {
    query: getMentorUnitsQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      createPaginatedResponseSchema(mentorUnitListItemSchema),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /mentor/units/:unitId
 *
 * Returns the full profile of a single unit.
 *
 * Guard (enforced in handler):
 *  - At least one of the mentor's accepted candidates must have applied
 *    to an internship belonging to this unit. Prevents a mentor from
 *    looking up arbitrary units.
 */
export const getMentorUnitProfile = createRoute({
  method: "get" as const,
  path: "/mentor/units/:unitId",
  tags: ["Mentor view - Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "Get a unit's full profile",
  description:
    "Returns the complete profile of a unit (company/organisation). " +
    "Only accessible if at least one of the mentor's accepted candidates " +
    "has applied to an internship belonging to that unit.",
  request: {
    params: z.object({
      unitId: z.uuid("Invalid unit ID"),
    }),
  },
  responses: {
    [OK]: createResponse(OK, mentorUnitProfileSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /mentor/stats
 *
 * Returns four summary tiles for the mentor's dashboard:
 *  - Total accepted mentees  + new this month
 *  - Unique units from mentees' applications + new this month
 *  - Upcoming (pending, future) meetings + new this month
 *  - Hired applications from accepted mentees + new this month
 */
export const getMentorStats = createRoute({
  method: "get" as const,
  path: "/mentor/stats",
  tags: ["Mentor view - Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "Mentor dashboard stat tiles",
  description:
    "Returns stats for the mentor's dashboard, including total mentees, pending requests, active units, meetings, and hired applications.",
  responses: {
    [OK]: createResponse(OK, mentorStatsResponseSchema),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

export type GetMentorStats = typeof getMentorStats;

export type GetMentorAcceptedCandidates = typeof getMentorAcceptedCandidates;
export type GetMentorUnits = typeof getMentorUnits;
export type GetMentorUnitProfile = typeof getMentorUnitProfile;
