import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { NOT_FOUND, OK } from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  detailedMentorSchema,
  getMentorsQuerySchema,
  mentorListItemSchema,
} from "./mentors.schema";

/**
 * GET /mentors - Get all available mentors with optional filters
 */
export const getMentors = createRoute({
  method: "get" as const,
  path: "/candidate/mentors",
  tags: ["Candidate - Mentors"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get all available mentors",
  description:
    "Returns a list of mentors available for candidates, with optional filters for mentor type, expertise area, and availability. Results are paginated.",
  request: {
    query: getMentorsQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        data: z.array(mentorListItemSchema),
        total: z.number(),
        limit: z.number(),
        offset: z.number(),
      }),
    ),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * GET /mentors/:mentorId - Get detailed information about a specific mentor
 */
export const getMentorById = createRoute({
  method: "get" as const,
  path: "/candidate/mentors/{mentorId}",
  tags: ["Candidate - Mentors"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Get detailed mentor information",
  description:
    "Returns detailed information about a specific mentor including their expertise, availability, capacity, and communication preferences.",
  responses: {
    [OK]: createResponse(OK, detailedMentorSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

export type GetMentors = typeof getMentors;
export type GetMentorById = typeof getMentorById;
