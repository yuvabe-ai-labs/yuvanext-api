import { createRoute } from "@hono/zod-openapi";

import {
  BAD_REQUEST,
  CONFLICT,
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
  candidateRequestItemSchema,
  createMentorshipRequestResponseSchema,
  createMentorshipRequestSchema,
  createPaginatedResponseSchema,
  getCandidateRequestsQuerySchema,
  getMentorRequestsQuerySchema,
  mentorRequestItemSchema,
  mentorshipRequestActionResponseSchema,
  respondToMentorshipRequestSchema,
} from "./mentorship-request.schema";

// ─── Candidate Routes ─────────────────────────────────────────────────────────

/**
 * POST /candidate/mentorship-requests
 * Candidate sends a mentorship request to a mentor.
 *
 * Guards (enforced in handler):
 *  - Candidate must not already have an accepted mentor
 *  - Candidate must not already have a pending request to this specific mentor
 */
export const createMentorshipRequest = createRoute({
  method: "post" as const,
  path: "/candidate/mentorship-requests",
  tags: ["Mentorship Requests - Candidate"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Send a mentorship request",
  description:
    "Allows a candidate to request mentorship from a mentor. " +
    "A candidate cannot send a request if they already have an active (accepted) " +
    "mentor, or if they already have a pending request to the same mentor.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createMentorshipRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, createMentorshipRequestResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    [CONFLICT]: createResponse(CONFLICT),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * DELETE /candidate/mentorship-requests/:requestId
 * Candidate cancels a pending request they previously sent.
 * Only "pending" requests can be cancelled.
 */
export const cancelMentorshipRequest = createRoute({
  method: "delete" as const,
  path: "/candidate/mentorship-requests/:requestId",
  tags: ["Mentorship Requests - Candidate"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Cancel a pending mentorship request",
  description:
    "Allows a candidate to cancel a mentorship request they previously sent, " +
    "as long as the mentor has not yet responded (status must be 'pending').",
  responses: {
    [OK]: createResponse(OK, mentorshipRequestActionResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /candidate/mentorship-requests
 * Candidate views all their own requests with search + pagination.
 * search → filter by mentor name
 */
export const getCandidateOwnRequests = createRoute({
  method: "get" as const,
  path: "/candidate/mentorship-requests",
  tags: ["Mentorship Requests - Candidate"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "List my mentorship requests",
  description:
    "Returns a paginated list of mentorship requests sent by the authenticated " +
    "candidate. Supports search by mentor name and optional status filter.",
  request: {
    query: getCandidateRequestsQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      createPaginatedResponseSchema(candidateRequestItemSchema),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// ─── Mentor Routes ────────────────────────────────────────────────────────────

/**
 * GET /mentor/mentorship-requests
 * Mentor views all requests directed at them with search + pagination.
 * search → filter by candidate name
 */
export const getMentorIncomingRequests = createRoute({
  method: "get" as const,
  path: "/mentor/mentorship-requests",
  tags: ["Mentorship Requests - Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "List incoming mentorship requests",
  description:
    "Returns a paginated list of mentorship requests sent to the authenticated " +
    "mentor. Supports search by candidate name and optional status filter.",
  request: {
    query: getMentorRequestsQuerySchema,
  },
  responses: {
    [OK]: createResponse(
      OK,
      createPaginatedResponseSchema(mentorRequestItemSchema),
    ),
    ...restrictedErrorResponses,
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * PUT /mentor/mentorship-requests/respond
 * Mentor accepts or rejects a request.
 *
 * ACCEPT:
 *   • This request            → "accepted"
 *   • All other pending from the same candidate → auto "rejected"
 *     (enforces the one-mentor-per-candidate rule)
 *
 * REJECT:
 *   • This request            → "rejected" (optionally with a reason)
 *   • Other requests from the candidate are untouched
 */
export const respondToMentorshipRequest = createRoute({
  method: "put" as const,
  path: "/mentor/mentorship-requests/respond",
  tags: ["Mentorship Requests - Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "Accept or reject a mentorship request",
  description:
    "Allows a mentor to accept or reject a pending mentorship request. " +
    "When accepting, all other pending requests from the same candidate are " +
    "automatically rejected to enforce the one-mentor-per-candidate constraint.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: respondToMentorshipRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, mentorshipRequestActionResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

// ─── Route Types ──────────────────────────────────────────────────────────────
export type CreateMentorshipRequest = typeof createMentorshipRequest;
export type CancelMentorshipRequest = typeof cancelMentorshipRequest;
export type GetCandidateOwnRequests = typeof getCandidateOwnRequests;
export type GetMentorIncomingRequests = typeof getMentorIncomingRequests;
export type RespondToMentorshipRequest = typeof respondToMentorshipRequest;
