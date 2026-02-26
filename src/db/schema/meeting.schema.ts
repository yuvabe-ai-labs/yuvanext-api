import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema";
import { candidates } from "./candidate.schema";
import { mentors } from "./mentor.schema";

export const meetingStatusEnum = pgEnum("meeting_status", [
  "pending",
  "completed",
  "cancelled",
]);

export const meetingPurposeEnum = pgEnum("meeting_purpose", [
  "weekly_check_in",
  "progress_review",
  "mid_point_evaluation",
  "final_assessment",
  "other",
]);

export const meetingTypeEnum = pgEnum("meeting_type", ["zoom", "in_person"]);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    mentorId: uuid("mentor_id")
      .notNull()
      .references(() => mentors.userId, { onDelete: "cascade" }),

    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.userId, { onDelete: "cascade" }),

    purpose: meetingPurposeEnum("purpose").notNull(),

    status: meetingStatusEnum("status").notNull().default("pending"),

    meetingType: meetingTypeEnum("meeting_type").notNull().default("zoom"),

    scheduledAt: timestamp("scheduled_at", {
      withTimezone: true,
      precision: 0,
    }).notNull(),

    durationMinutes: text("duration_minutes").default("30"),

    // renamed from agenda
    description: text("description"),

    // optional — no .notNull()
    cancellationReason: text("cancellation_reason"),

    location: text("location"),

    // Zoom fields
    zoomMeetingId: text("zoom_meeting_id"),
    zoomJoinUrl: text("zoom_join_url"),
    zoomStartUrl: text("zoom_start_url"),

    createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    mentorIdIdx: index("meetings_mentor_id_index").on(table.mentorId),
    candidateIdIdx: index("meetings_candidate_id_index").on(table.candidateId),
    statusIdx: index("meetings_status_index").on(table.status),
    scheduledAtIdx: index("meetings_scheduled_at_index").on(table.scheduledAt),
  }),
);

export const meetingsRelations = relations(meetings, ({ one }) => ({
  mentor: one(mentors, {
    fields: [meetings.mentorId],
    references: [mentors.userId],
  }),
  candidate: one(candidates, {
    fields: [meetings.candidateId],
    references: [candidates.userId],
  }),
  mentorUser: one(user, {
    fields: [meetings.mentorId],
    references: [user.id],
  }),
  candidateUser: one(user, {
    fields: [meetings.candidateId],
    references: [user.id],
  }),
}));

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
