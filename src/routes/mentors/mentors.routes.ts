import { createRoute } from "@hono/zod-openapi";

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
  createPaginatedResponseSchema,
  detailedMentorSchema,
  getMentorsQuerySchema,
  mentorListItemSchema,
} from "./mentors.schema";

/**
 * GET /candidate/mentors
 * List all onboarded mentors with optional search + filters, paginated.
 */
export const getMentors = createRoute({
  method: "get" as const,
  path: "/mentors",
  tags: ["Candidate - Mentors"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get all available mentors",
  description:
    "Returns a paginated list of mentors available to candidates. " +
    "Supports free-text search by name, and filters for mentor type, " +
    "expertise area, and availability day.",
  request: {
    query: getMentorsQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      createPaginatedResponseSchema(mentorListItemSchema),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /candidate/mentors/:mentorId
 * Full detail view for a single mentor.
 */
export const getMentorById = createRoute({
  method: "get" as const,
  path: "/mentors/:mentorId",
  tags: ["Candidate - Mentors"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get detailed mentor information",
  description:
    "Returns full profile for a specific mentor including availability, " +
    "capacity, preferred stages, and communication preferences.",
  responses: {
    [OK]: createResponse(OK, detailedMentorSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

export type GetMentors = typeof getMentors;
export type GetMentorById = typeof getMentorById;
