import { and, count, desc, eq, ilike } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { meetings } from "@/db/schema/meeting.schema";
import { mentorshipRequests } from "@/db/schema/mentorship-requests.schema";
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";
import {
  cancelZoomMeeting,
  createZoomMeeting,
} from "@/lib/services/zoom.service";

import type {
  CancelMeeting,
  CreateMeeting,
  GetMentorMeetings,
} from "./meeting.routes";

// ─── Create Meeting ───────────────────────────────────────────────────────────

/**
 * POST /mentor/meetings
 *
 * Guards:
 *  1. candidateId must belong to an accepted mentee of this mentor.
 *  2. scheduledAt office-hours validation is done by Zod already.
 *
 * Zoom:
 *  - Attempts to create a Zoom meeting automatically.
 *  - If Zoom fails, the meeting is still saved — zoomJoinUrl will be null.
 *    zoomCreated in the response tells the caller whether Zoom succeeded.
 */
export const createMeeting: AppRouteHandler<CreateMeeting> = async (c) => {
  const mentor = c.get("user");

  try {
    const {
      candidateId,
      purpose,
      scheduledAt,
      durationMinutes = 30,
      description,
    } = c.req.valid("json");

    // Guard: candidate must be an accepted mentee of this mentor
    const [accepted] = await db
      .select({ id: mentorshipRequests.id })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.candidateId, candidateId),
          eq(mentorshipRequests.status, "accepted"),
        ),
      )
      .limit(1);

    if (!accepted) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message:
            "Candidate not found or is not one of your accepted mentees.",
        },
        NOT_FOUND,
      );
    }

    // Fetch candidate name for the Zoom meeting topic
    const [candidateUser] = await db
      .select({ name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, candidateId))
      .limit(1);

    // Attempt to create Zoom meeting
    const purposeLabel = purpose.replace(/_/g, " ");
    const zoomMeeting = await createZoomMeeting({
      topic: `Mentor Meeting: ${purposeLabel} with ${candidateUser?.name ?? "Candidate"}`,
      startTime: scheduledAt,
      duration: durationMinutes,
      attendeeEmail: candidateUser?.email ?? "",
      attendeeName: candidateUser?.name ?? "Candidate",
    });

    // Save meeting to DB — even if Zoom failed, we still create the record
    const [newMeeting] = await db
      .insert(meetings)
      .values({
        mentorId: mentor.id,
        candidateId,
        purpose,
        status: "pending",
        scheduledAt: new Date(scheduledAt),
        durationMinutes: String(durationMinutes),
        description: description ?? null,
        cancellationReason: null,
        zoomMeetingId: zoomMeeting?.meetingId ?? null,
        zoomJoinUrl: zoomMeeting?.joinUrl ?? null,
        zoomStartUrl: zoomMeeting?.startUrl ?? null,
      })
      .returning();

    return c.json(
      {
        status_code: OK,
        message: zoomMeeting
          ? "Meeting created successfully with Zoom link."
          : "Meeting created successfully. Zoom link could not be generated.",
        data: {
          id: newMeeting.id,
          mentorId: newMeeting.mentorId,
          candidateId: newMeeting.candidateId,
          purpose: newMeeting.purpose,
          status: newMeeting.status,
          scheduledAt: newMeeting.scheduledAt,
          durationMinutes: newMeeting.durationMinutes,
          description: newMeeting.description,
          zoomJoinUrl: newMeeting.zoomJoinUrl,
          zoomStartUrl: newMeeting.zoomStartUrl,
          zoomCreated: zoomMeeting !== null,
          createdAt: newMeeting.createdAt,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error creating meeting:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// ─── Cancel Meeting ───────────────────────────────────────────────────────────

/**
 * PUT /mentor/meetings/cancel
 *
 * - Only the mentor who created the meeting can cancel it.
 * - Only "pending" or "completed" meetings can be cancelled.
 * - If a Zoom meeting was created, it is also cancelled via the Zoom API.
 *   If Zoom cancellation fails, the DB record is still marked cancelled.
 */
export const cancelMeeting: AppRouteHandler<CancelMeeting> = async (c) => {
  const mentor = c.get("user");

  try {
    const { meetingId, cancellationReason } = c.req.valid("json");

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!meeting) {
      return c.json(
        { status_code: NOT_FOUND, message: "Meeting not found." },
        NOT_FOUND,
      );
    }

    if (meeting.mentorId !== mentor.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only cancel your own meetings.",
        },
        FORBIDDEN,
      );
    }

    if (meeting.status === "cancelled") {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "This meeting has already been cancelled.",
        },
        BAD_REQUEST,
      );
    }

    // Cancel Zoom meeting if one was created
    let zoomCancelled = false;
    if (meeting.zoomMeetingId) {
      zoomCancelled = await cancelZoomMeeting(meeting.zoomMeetingId);
      if (!zoomCancelled) {
        console.error(
          `Failed to cancel Zoom meeting ${meeting.zoomMeetingId} for DB meeting ${meetingId}. Proceeding with DB update.`,
        );
      }
    }

    const [updated] = await db
      .update(meetings)
      .set({
        status: "cancelled",
        cancellationReason,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, meetingId))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Meeting cancelled successfully.",
        data: {
          id: updated.id,
          status: updated.status,
          cancellationReason: updated.cancellationReason ?? null,
          zoomCancelled,
          updatedAt: updated.updatedAt,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error cancelling meeting:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// ─── List Meetings ────────────────────────────────────────────────────────────

/**
 * GET /mentor/meetings
 *
 * Paginated list of all meetings for this mentor.
 * search  → candidate name (case-insensitive)
 * status  → meeting status filter
 * purpose → meeting purpose filter
 */
export const getMentorMeetings: AppRouteHandler<GetMentorMeetings> = async (
  c,
) => {
  const mentor = c.get("user");
  const {
    search,
    status,
    purpose,
    page = 1,
    limit = 10,
  } = c.req.valid("query");

  try {
    const offset = (page - 1) * limit;

    const baseConditions = [eq(meetings.mentorId, mentor.id)];
    if (status) baseConditions.push(eq(meetings.status, status));
    if (purpose) baseConditions.push(eq(meetings.purpose, purpose));

    const searchCondition = search
      ? ilike(userTable.name, `%${search}%`)
      : undefined;

    const allConditions = searchCondition
      ? and(...baseConditions, searchCondition)
      : and(...baseConditions);

    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          id: meetings.id,
          purpose: meetings.purpose,
          status: meetings.status,
          scheduledAt: meetings.scheduledAt,
          durationMinutes: meetings.durationMinutes,
          description: meetings.description,
          cancellationReason: meetings.cancellationReason,
          zoomJoinUrl: meetings.zoomJoinUrl,
          zoomStartUrl: meetings.zoomStartUrl,
          createdAt: meetings.createdAt,
          updatedAt: meetings.updatedAt,
          candidateUserId: candidates.userId,
          candidateName: userTable.name,
          candidateEmail: userTable.email,
          candidateAvatarUrl: candidates.avatarUrl,
          candidateProfileSummary: candidates.profileSummary,
          candidateSkills: candidates.skills,
          candidateExperienceLevel: candidates.experienceLevel,
        })
        .from(meetings)
        .innerJoin(candidates, eq(meetings.candidateId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(allConditions)
        .orderBy(desc(meetings.scheduledAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(meetings)
        .innerJoin(candidates, eq(meetings.candidateId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    const data = rows.map((row) => ({
      id: row.id,
      purpose: row.purpose,
      status: row.status,
      scheduledAt: row.scheduledAt,
      durationMinutes: row.durationMinutes,
      description: row.description,
      cancellationReason: row.cancellationReason,
      zoomJoinUrl: row.zoomJoinUrl,
      zoomStartUrl: row.zoomStartUrl,
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

    const message =
      data.length === 0
        ? "No meetings found."
        : "Meetings retrieved successfully.";

    return c.json(
      {
        status_code: OK,
        message,
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
    console.error("Error fetching mentor meetings:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};
