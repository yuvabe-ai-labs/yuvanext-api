import { and, count, desc, eq, ilike, ne, sql } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { mentors } from "@/db/schema/mentor.schema";
import { mentorshipRequests } from "@/db/schema/mentorship-requests.schema";
import {
  BAD_REQUEST,
  CONFLICT,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type {
  CancelMentorshipRequest,
  CreateMentorshipRequest,
  GetCandidateOwnRequests,
  GetMentorIncomingRequests,
  RespondToMentorshipRequest,
} from "./mentorship-request.routes";

// ─── Candidate Handlers ───────────────────────────────────────────────────────

/**
 * POST /candidate/mentorship-requests
 *
 * Guards:
 *  1. Target mentor must exist and have completed onboarding.
 *  2. Candidate must not already have an accepted mentorship.
 *  3. Candidate must not already have a pending request to this exact mentor.
 */
export const createMentorshipRequest: AppRouteHandler<
  CreateMentorshipRequest
> = async (c) => {
  const user = c.get("user");

  try {
    const { mentorId, message } = c.req.valid("json");

    // Guard 1: mentor must exist and be onboarded
    const [mentor] = await db
      .select({ userId: mentors.userId })
      .from(mentors)
      .where(
        and(
          eq(mentors.userId, mentorId),
          eq(mentors.onboardingCompleted, true),
        ),
      )
      .limit(1);

    if (!mentor) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Mentor not found or not available",
        },
        NOT_FOUND,
      );
    }

    // Guard 2: candidate must not already have an accepted mentor
    const [activeMentorship] = await db
      .select({ id: mentorshipRequests.id })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.candidateId, user.id),
          eq(mentorshipRequests.status, "accepted"),
        ),
      )
      .limit(1);

    if (activeMentorship) {
      return c.json(
        {
          status_code: CONFLICT,
          message:
            "You already have an active mentor. Cancel your current mentorship before requesting a new one.",
        },
        CONFLICT,
      );
    }

    // Guard 3: no duplicate pending request to the same mentor
    const [existingRequest] = await db
      .select({ id: mentorshipRequests.id })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.candidateId, user.id),
          eq(mentorshipRequests.mentorId, mentorId),
          eq(mentorshipRequests.status, "pending"),
        ),
      )
      .limit(1);

    if (existingRequest) {
      return c.json(
        {
          status_code: CONFLICT,
          message:
            "You already have a pending request to this mentor. Please wait for their response.",
        },
        CONFLICT,
      );
    }

    // Create the request
    const [newRequest] = await db
      .insert(mentorshipRequests)
      .values({
        candidateId: user.id,
        mentorId,
        status: "pending",
        message: message ?? null,
      })
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Mentorship request sent successfully",
        data: {
          id: newRequest.id,
          candidateId: newRequest.candidateId,
          mentorId: newRequest.mentorId,
          status: newRequest.status,
          message: newRequest.message,
          createdAt: newRequest.createdAt,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error creating mentorship request:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * DELETE /candidate/mentorship-requests/:requestId
 *
 * Only the owning candidate can cancel, and only while status is "pending".
 */
export const cancelMentorshipRequest: AppRouteHandler<
  CancelMentorshipRequest
> = async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("requestId");

  try {
    const [request] = await db
      .select()
      .from(mentorshipRequests)
      .where(eq(mentorshipRequests.id, requestId))
      .limit(1);

    if (!request) {
      return c.json(
        { status_code: NOT_FOUND, message: "Mentorship request not found" },
        NOT_FOUND,
      );
    }

    if (request.candidateId !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only cancel your own requests",
        },
        FORBIDDEN,
      );
    }

    if (request.status !== "pending") {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: `Cannot cancel a request with status "${request.status}". Only pending requests can be cancelled.`,
        },
        BAD_REQUEST,
      );
    }

    const [updated] = await db
      .update(mentorshipRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(mentorshipRequests.id, requestId))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Mentorship request cancelled successfully",
        data: {
          id: updated.id,
          status: updated.status,
          updatedAt: updated.updatedAt,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error cancelling mentorship request:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /candidate/mentorship-requests
 *
 * Paginated list of requests sent by the authenticated candidate.
 * search  → filters by mentor name (case-insensitive)
 * status  → filters by request status
 *
 * Pagination follows the admin pattern:
 *   offset = (page - 1) * limit
 *   response includes: { data, pagination: { currentPage, totalPages, totalItems, itemsPerPage } }
 */
export const getCandidateOwnRequests: AppRouteHandler<
  GetCandidateOwnRequests
> = async (c) => {
  const user = c.get("user");
  const { search, status, page = 1, limit = 10 } = c.req.valid("query");

  try {
    const offset = (page - 1) * limit;

    // Build conditions on the mentorship_requests table
    const requestConditions = [eq(mentorshipRequests.candidateId, user.id)];
    if (status) {
      requestConditions.push(eq(mentorshipRequests.status, status));
    }

    // search filters on the joined mentor's user name
    const mentorNameCondition = search
      ? ilike(userTable.name, `%${search}%`)
      : undefined;

    const allConditions = mentorNameCondition
      ? and(...requestConditions, mentorNameCondition)
      : and(...requestConditions);

    // Count + data queries in parallel (mirrors admin pattern)
    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          // Request
          id: mentorshipRequests.id,
          status: mentorshipRequests.status,
          message: mentorshipRequests.message,
          rejectionReason: mentorshipRequests.rejectionReason,
          createdAt: mentorshipRequests.createdAt,
          updatedAt: mentorshipRequests.updatedAt,
          // Mentor snapshot
          mentorUserId: mentors.userId,
          mentorName: userTable.name,
          mentorEmail: userTable.email,
          mentorImage: userTable.image,
          mentorType: mentors.mentorType,
          expertiseAreas: mentors.expertiseAreas,
          experienceSnapshot: mentors.experienceSnapshot,
        })
        .from(mentorshipRequests)
        .innerJoin(mentors, eq(mentorshipRequests.mentorId, mentors.userId))
        .innerJoin(userTable, eq(mentors.userId, userTable.id))
        .where(allConditions)
        .orderBy(desc(mentorshipRequests.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .innerJoin(mentors, eq(mentorshipRequests.mentorId, mentors.userId))
        .innerJoin(userTable, eq(mentors.userId, userTable.id))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const data = rows.map((row) => ({
      id: row.id,
      status: row.status,
      message: row.message,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      mentor: {
        userId: row.mentorUserId,
        name: row.mentorName,
        email: row.mentorEmail,
        image: row.mentorImage,
        mentorType: row.mentorType,
        expertiseAreas: row.expertiseAreas,
        experienceSnapshot: row.experienceSnapshot,
      },
    }));

    return c.json(
      {
        status_code: OK,
        message: "Mentorship requests retrieved successfully",
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching candidate mentorship requests:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// ─── Mentor Handlers ──────────────────────────────────────────────────────────

/**
 * GET /mentor/mentorship-requests
 *
 * Paginated list of requests directed at the authenticated mentor.
 * search  → filters by candidate name (case-insensitive)
 * status  → filters by request status
 *
 * Pagination follows the admin pattern.
 */
export const getMentorIncomingRequests: AppRouteHandler<
  GetMentorIncomingRequests
> = async (c) => {
  const user = c.get("user");
  const { search, status, page = 1, limit = 10 } = c.req.valid("query");

  try {
    const offset = (page - 1) * limit;

    const requestConditions = [eq(mentorshipRequests.mentorId, user.id)];
    if (status) {
      requestConditions.push(eq(mentorshipRequests.status, status));
    }

    // search filters on the joined candidate's user name
    const candidateNameCondition = search
      ? ilike(userTable.name, `%${search}%`)
      : undefined;

    const allConditions = candidateNameCondition
      ? and(...requestConditions, candidateNameCondition)
      : and(...requestConditions);

    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          // Request
          id: mentorshipRequests.id,
          status: mentorshipRequests.status,
          message: mentorshipRequests.message,
          rejectionReason: mentorshipRequests.rejectionReason,
          createdAt: mentorshipRequests.createdAt,
          updatedAt: mentorshipRequests.updatedAt,
          // Candidate snapshot
          candidateUserId: candidates.userId,
          candidateName: userTable.name,
          candidateEmail: userTable.email,
          candidateAvatarUrl: candidates.avatarUrl,
          candidateProfileSummary: candidates.profileSummary,
          candidateSkills: candidates.skills,
          candidateExperienceLevel: candidates.experienceLevel,
        })
        .from(mentorshipRequests)
        .innerJoin(
          candidates,
          eq(mentorshipRequests.candidateId, candidates.userId),
        )
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(allConditions)
        .orderBy(desc(mentorshipRequests.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .innerJoin(
          candidates,
          eq(mentorshipRequests.candidateId, candidates.userId),
        )
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const data = rows.map((row) => ({
      id: row.id,
      status: row.status,
      message: row.message,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      candidate: {
        userId: row.candidateUserId,
        name: row.candidateName,
        email: row.candidateEmail,
        avatarUrl: row.candidateAvatarUrl,
        profileSummary: row.candidateProfileSummary,
        skills: row.candidateSkills,
        experienceLevel: row.candidateExperienceLevel,
      },
    }));

    return c.json(
      {
        status_code: OK,
        message: "Mentorship requests retrieved successfully",
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching mentor incoming requests:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * PUT /mentor/mentorship-requests/respond
 *
 * ACCEPT flow:
 *  1. Verify request belongs to this mentor and is "pending".
 *  2. Set this request → "accepted".
 *  3. Auto-reject ALL OTHER pending requests from the same candidate
 *     (enforces the one-mentor-per-candidate rule).
 *  4. Return autoRejectedCount so the caller knows what happened.
 *
 * REJECT flow:
 *  1. Verify as above.
 *  2. Set this request → "rejected" with optional reason.
 *  3. Other requests from the candidate remain untouched.
 */
export const respondToMentorshipRequest: AppRouteHandler<
  RespondToMentorshipRequest
> = async (c) => {
  const user = c.get("user");

  try {
    const { requestId, action, rejectionReason } = c.req.valid("json");

    const [request] = await db
      .select()
      .from(mentorshipRequests)
      .where(eq(mentorshipRequests.id, requestId))
      .limit(1);

    if (!request) {
      return c.json(
        { status_code: NOT_FOUND, message: "Mentorship request not found" },
        NOT_FOUND,
      );
    }

    if (request.mentorId !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only respond to requests directed at you",
        },
        FORBIDDEN,
      );
    }

    if (request.status !== "pending") {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: `Cannot respond to a request with status "${request.status}". Only pending requests can be accepted or rejected.`,
        },
        BAD_REQUEST,
      );
    }

    // ── ACCEPT ────────────────────────────────────────────────────────────────
    if (action === "accept") {
      // Step 1: accept this request
      const [accepted] = await db
        .update(mentorshipRequests)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(mentorshipRequests.id, requestId))
        .returning();

      // Step 2: auto-reject every OTHER pending request from this candidate
      // This is the core of the one-mentor-per-candidate enforcement.
      const autoRejected = await db
        .update(mentorshipRequests)
        .set({
          status: "rejected",
          rejectionReason:
            "Your mentorship request was automatically declined because you have been matched with another mentor.",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mentorshipRequests.candidateId, request.candidateId),
            eq(mentorshipRequests.status, "pending"),
            ne(mentorshipRequests.id, requestId),
          ),
        )
        .returning();

      return c.json(
        {
          status_code: OK,
          message: "Mentorship request accepted successfully",
          data: {
            id: accepted.id,
            status: accepted.status,
            updatedAt: accepted.updatedAt,
            autoRejectedCount: autoRejected.length,
          },
        },
        OK,
      );
    }

    // ── REJECT ────────────────────────────────────────────────────────────────
    const [rejected] = await db
      .update(mentorshipRequests)
      .set({
        status: "rejected",
        rejectionReason: rejectionReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(mentorshipRequests.id, requestId))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Mentorship request rejected",
        data: {
          id: rejected.id,
          status: rejected.status,
          updatedAt: rejected.updatedAt,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error responding to mentorship request:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};
