import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  BAD_REQUEST,
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
  cancelMeetingResponseSchema,
  cancelMeetingSchema,
  createMeetingResponseSchema,
  createMeetingSchema,
  createPaginatedResponseSchema,
  getMeetingsQuerySchema,
  meetingItemSchema,
} from "./meeting.schema";

// ─── Create Meeting ───────────────────────────────────────────────────────────

/**
 * POST /mentor/meetings
 *
 * Mentor creates a meeting with one of their accepted candidates.
 *
 * Guards (enforced in handler):
 *  - candidateId must belong to an accepted mentee of this mentor.
 *  - scheduledAt must be a weekday between 09:00 and 17:00.
 */
export const createMeeting = createRoute({
  method: "post" as const,
  path: "/meetings",
  tags: ["Meetings"],
  middleware: requireRole({ allowedRoles: ["mentor", "candidate"] }),
  summary: "Create a meeting",
  description:
    "Allows a mentor or candidate to schedule a meeting. " +
    "If candidate creates, the time must match the mentor's availability. " +
    "They must have an accepted mentorship request.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createMeetingSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, createMeetingResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// ─── Cancel Meeting ───────────────────────────────────────────────────────────

/**
 * PUT /mentor/meetings/cancel
 *
 * Mentor cancels a pending or completed meeting.
 * A cancellation reason is required.
 */
export const cancelMeeting = createRoute({
  method: "put" as const,
  path: "/meetings/cancel",
  tags: ["Meetings"],
  middleware: requireRole({ allowedRoles: ["mentor", "candidate"] }),
  summary: "Cancel a meeting",
  description:
    "Allows the meeting creator (or counterpart) to cancel a meeting. Requires a reason.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: cancelMeetingSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, cancelMeetingResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// ─── List Meetings ────────────────────────────────────────────────────────────

/**
 * GET /mentor/meetings
 *
 * Paginated list of all meetings created by this mentor.
 * search  → filter by candidate name
 * status  → filter by meeting status
 * purpose → filter by meeting purpose
 */
export const getMeetings = createRoute({
  method: "get" as const,
  path: "/meetings",
  tags: ["Meetings"],
  middleware: requireRole({ allowedRoles: ["mentor", "candidate"] }),
  summary: "List all meetings",
  description:
    "Returns a paginated list of all meetings created by the authenticated user.",
  request: {
    query: getMeetingsQuerySchema,
  },
  responses: {
    [OK]: createResponse(OK, createPaginatedResponseSchema(meetingItemSchema)),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// ─── Route Types ──────────────────────────────────────────────────────────────

export type CreateMeeting = typeof createMeeting;
export type CancelMeeting = typeof cancelMeeting;
export type GetMeetings = typeof getMeetings;
