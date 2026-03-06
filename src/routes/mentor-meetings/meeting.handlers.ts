import { and, count, desc, eq, ilike } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { meetings } from "@/db/schema/meeting.schema";
import { mentorshipRequests } from "@/db/schema/mentorship-requests.schema";
import { userSettings } from "@/db/schema/settings.schema";
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
import {
  sendMeetingCreatedEmail,
  sendMeetingCancelledEmail,
} from "@/lib/services/email.service";

import type {
  CancelMeeting,
  CreateMeeting,
  GetMeetings,
} from "./meeting.routes";
import { mentors } from "@/db/schema/mentor.schema";
import { notifications } from "@/db/schema/notification.schema";

// ─── Notification helpers ─────────────────────────────────────────────────────

interface NotificationSettings {
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  try {
    const [settings] = await db
      .select({
        emailEnabled: userSettings.emailNotificationsEnabled,
        inAppEnabled: userSettings.inAppNotificationsEnabled,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return {
      emailEnabled: settings?.emailEnabled ?? true,
      inAppEnabled: settings?.inAppEnabled ?? true,
    };
  } catch (err) {
    console.error("Error checking notification settings:", err);
    return { emailEnabled: true, inAppEnabled: true };
  }
}

async function createInAppNotification(
  userId: string,
  title: string,
  message: string,
  type: "success" | "info" | "warning" | "error" = "info",
) {
  await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    isRead: false,
  });
}

// ─── Create Meeting ───────────────────────────────────────────────────────────

export const createMeeting: AppRouteHandler<CreateMeeting> = async (c) => {
  const user = c.get("user");

  try {
    // Note: You will need to update your Zod schema to allow mentorId to be passed when a candidate is creating!
    const {
      candidateId,
      mentorId,
      purpose,
      meetingType,
      scheduledAt,
      durationMinutes = 30,
      description,
      location,
    } = c.req.valid("json");

    // 1. Determine roles dynamically
    const actualMentorId = user.role === "mentor" ? user.id : mentorId;
    const actualCandidateId = user.role === "candidate" ? user.id : candidateId;

    if (!actualMentorId || !actualCandidateId) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Missing mentorId or candidateId.",
        },
        BAD_REQUEST,
      );
    }

    // 2. Guard: Must be accepted mentees
    const [accepted] = await db
      .select({ id: mentorshipRequests.id })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, actualMentorId),
          eq(mentorshipRequests.candidateId, actualCandidateId),
          eq(mentorshipRequests.status, "accepted"),
        ),
      )
      .limit(1);

    if (!accepted) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Mentorship connection not found or not accepted.",
        },
        NOT_FOUND,
      );
    }

    // 3. CANDIDATE SPECIFIC LOGIC: Check Mentor Availability
    if (user.role === "candidate") {
      const [mentorSettings] = await db
        .select()
        .from(mentors)
        .where(eq(mentors.userId, actualMentorId))
        .limit(1);

      if (mentorSettings) {
        const requestedDate = new Date(scheduledAt);
        const mentorTz = mentorSettings.timezone || "UTC";

        // Convert requested time to mentor's timezone to check day and time bounds
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: mentorTz,
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const parts = formatter.formatToParts(requestedDate);

        const dayName = parts.find((p) => p.type === "weekday")?.value || "";
        const hour = parts.find((p) => p.type === "hour")?.value || "00";
        const minute = parts.find((p) => p.type === "minute")?.value || "00";
        const timeStr = `${hour}:${minute}`;

        const isDayAvailable =
          mentorSettings.availabilityDays?.includes(dayName);
        const isTimeAvailable = mentorSettings.availabilityTimeWindows?.some(
          (window) => {
            return timeStr >= window.start && timeStr <= window.end;
          },
        );

        if (!isDayAvailable || !isTimeAvailable) {
          return c.json(
            {
              status_code: BAD_REQUEST,
              message: `Mentor is not available at this time in their timezone (${mentorTz}).`,
            },
            BAD_REQUEST,
          );
        }
      }
    }

    // 4. Fetch the counterpart details for Zoom & Notifications
    const counterpartId =
      user.role === "mentor" ? actualCandidateId : actualMentorId;
    const [counterpartUser] = await db
      .select({ name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, counterpartId))
      .limit(1);

    const purposeLabel = purpose.replace(/_/g, " ");

    // ── Zoom (only when meetingType = "zoom") ─────────────────────────────────
    let zoomMeeting = null;
    if (meetingType === "zoom") {
      zoomMeeting = await createZoomMeeting({
        topic: `Mentor Meeting: ${purposeLabel}`,
        startTime: scheduledAt,
        duration: durationMinutes,
        attendeeEmail: counterpartUser?.email ?? "",
        attendeeName: counterpartUser?.name ?? "User",
      });
    }

    // Save meeting to DB
    const [newMeeting] = await db
      .insert(meetings)
      .values({
        mentorId: actualMentorId,
        candidateId: actualCandidateId,
        purpose,
        meetingType,
        status: "pending",
        scheduledAt: new Date(scheduledAt),
        durationMinutes: String(durationMinutes),
        description: description ?? null,
        location: meetingType === "in_person" ? (location ?? null) : null,
        zoomMeetingId: zoomMeeting?.meetingId ?? null,
        zoomJoinUrl: zoomMeeting?.joinUrl ?? null,
        zoomStartUrl: zoomMeeting?.startUrl ?? null,
      })
      .returning();

    // ── Notifications ─────────────────────────────────────────────────────────
    const counterpartSettings = await getNotificationSettings(counterpartId);
    const scheduledDate = new Date(scheduledAt).toLocaleString("en-IN", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const creatorRoleName =
      user.role === "mentor" ? "Your mentor" : "Your mentee";
    const notificationTitle = "Meeting Scheduled!";
    const notificationMessage =
      meetingType === "zoom"
        ? `${creatorRoleName} has scheduled a ${purposeLabel} meeting on ${scheduledDate}.` +
          (zoomMeeting?.joinUrl ? ` Join here: ${zoomMeeting.joinUrl}` : "")
        : `${creatorRoleName} has scheduled an in-person ${purposeLabel} meeting on ${scheduledDate} at ${location}.`;

    if (counterpartSettings.inAppEnabled) {
      await createInAppNotification(
        counterpartId,
        notificationTitle,
        notificationMessage,
        "info",
      );
    }

    let emailSent = false;
    if (counterpartSettings.emailEnabled && counterpartUser?.email) {
      emailSent = await sendMeetingCreatedEmail({
        to: counterpartUser.email,
        candidateName:
          user.role === "candidate"
            ? (user.name ?? "Candidate")
            : (counterpartUser.name ?? "Candidate"),
        mentorName:
          user.role === "mentor"
            ? (user.name ?? "Mentor")
            : (counterpartUser.name ?? "Mentor"),
        purpose: purposeLabel,
        meetingType,
        scheduledAt: new Date(scheduledAt),
        durationMinutes,
        zoomJoinUrl: zoomMeeting?.joinUrl ?? null,
        location: meetingType === "in_person" ? (location ?? null) : null,
        description: description ?? null,
      });
    }

    return c.json(
      {
        status_code: OK,
        message: "Meeting created successfully.",
        data: newMeeting,
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

export const cancelMeeting: AppRouteHandler<CancelMeeting> = async (c) => {
  const user = c.get("user");

  try {
    const { meetingId, cancellationReason } = c.req.valid("json");

    // Fetch the meeting along with both mentor and candidate user details
    const [meetingRow] = await db
      .select({
        meeting: meetings,
        candidateName: userTable.name,
        candidateEmail: userTable.email,
      })
      .from(meetings)
      .innerJoin(userTable, eq(meetings.candidateId, userTable.id))
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!meetingRow) {
      return c.json(
        { status_code: NOT_FOUND, message: "Meeting not found." },
        NOT_FOUND,
      );
    }

    const { meeting, candidateName, candidateEmail } = meetingRow;

    // Both the mentor and the candidate who own this meeting may cancel it
    const isMentor = meeting.mentorId === user.id;
    const isCandidate = meeting.candidateId === user.id;

    if (!isMentor && !isCandidate) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only cancel meetings you are part of.",
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

    // Cancel Zoom meeting only if it was a Zoom meeting
    let zoomCancelled = false;
    if (meeting.meetingType === "zoom" && meeting.zoomMeetingId) {
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
        cancellationReason: cancellationReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, meetingId))
      .returning();

    // ── Notifications ─────────────────────────────────────────────────────────
    // Notify the counterpart (the person who did NOT cancel)
    const counterpartId = isMentor ? meeting.candidateId : meeting.mentorId;
    const counterpartSettings = await getNotificationSettings(counterpartId);

    const purposeLabel = meeting.purpose.replace(/_/g, " ");
    const scheduledDate = meeting.scheduledAt.toLocaleString("en-IN", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const cancellerLabel = isMentor ? "Your mentor" : "Your mentee";
    const notificationTitle = "Meeting Cancelled";
    const notificationMessage =
      `${cancellerLabel} has cancelled the ${purposeLabel} meeting scheduled for ${scheduledDate}.` +
      (cancellationReason ? ` Reason: ${cancellationReason}` : "");

    if (counterpartSettings.inAppEnabled) {
      await createInAppNotification(
        counterpartId,
        notificationTitle,
        notificationMessage,
        "warning",
      );
    }

    // Fetch counterpart email for email notification (mentor email needed when candidate cancels)
    let counterpartEmail: string | null = null;
    let counterpartName: string | null = null;
    if (isMentor) {
      // counterpart is candidate — already have these from the join
      counterpartEmail = candidateEmail;
      counterpartName = candidateName;
    } else {
      // counterpart is mentor — fetch separately
      const [mentorUser] = await db
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, meeting.mentorId))
        .limit(1);
      counterpartEmail = mentorUser?.email ?? null;
      counterpartName = mentorUser?.name ?? null;
    }

    let emailSent = false;
    if (counterpartSettings.emailEnabled && counterpartEmail) {
      emailSent = await sendMeetingCancelledEmail({
        to: counterpartEmail,
        candidateName: isMentor
          ? (candidateName ?? "Candidate")
          : (user.name ?? "Candidate"),
        mentorName: isMentor
          ? (user.name ?? "Mentor")
          : (counterpartName ?? "Mentor"),
        purpose: purposeLabel,
        meetingType: meeting.meetingType,
        scheduledAt: meeting.scheduledAt,
        location: meeting.location ?? null,
        cancellationReason: cancellationReason ?? null,
      });
    }

    return c.json(
      {
        status_code: OK,
        message: "Meeting cancelled successfully.",
        data: {
          id: updated.id,
          status: updated.status,
          cancellationReason: updated.cancellationReason ?? null,
          zoomCancelled,
          notificationSent: counterpartSettings.inAppEnabled,
          emailSent,
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

export const getMeetings: AppRouteHandler<GetMeetings> = async (c) => {
  const mentor = c.get("user");
  const {
    search,
    status,
    purpose,
    meetingType,
    page = 1,
    limit = 10,
  } = c.req.valid("query");

  try {
    const offset = (page - 1) * limit;

    const baseConditions = [eq(meetings.mentorId, mentor.id)];
    if (status) baseConditions.push(eq(meetings.status, status));
    if (purpose) baseConditions.push(eq(meetings.purpose, purpose));
    if (meetingType) baseConditions.push(eq(meetings.meetingType, meetingType));

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
          meetingType: meetings.meetingType,
          status: meetings.status,
          scheduledAt: meetings.scheduledAt,
          durationMinutes: meetings.durationMinutes,
          description: meetings.description,
          cancellationReason: meetings.cancellationReason,
          location: meetings.location,
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
      meetingType: row.meetingType,
      status: row.status,
      scheduledAt: row.scheduledAt,
      durationMinutes: row.durationMinutes,
      description: row.description,
      cancellationReason: row.cancellationReason,
      location: row.location,
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

    return c.json(
      {
        status_code: OK,
        message:
          data.length === 0
            ? "No meetings found."
            : "Meetings retrieved successfully.",
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
