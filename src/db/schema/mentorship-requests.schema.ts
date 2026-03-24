import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";
import { candidates } from "./candidate.schema";
import { mentors } from "./mentor.schema";

export const mentorshipRequestStatusEnum = pgEnum("mentorship_request_status", [
  "pending", // Candidate sent request, waiting for mentor response
  "accepted", // Mentor accepted → all other pending requests from this candidate are auto-rejected
  "rejected", // Mentor rejected, or auto-rejected when another mentor accepted
  "cancelled", // Candidate cancelled before mentor responded
]);

export const mentorshipRequests = pgTable("mentorship_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidates.userId, { onDelete: "cascade" }),
  mentorId: uuid("mentor_id")
    .notNull()
    .references(() => mentors.userId, { onDelete: "cascade" }),
  status: mentorshipRequestStatusEnum("status").notNull().default("pending"),
  message: text("message"), // Candidate's optional intro message
  rejectionReason: text("rejection_reason"), // Mentor's optional reason on reject
  createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
});

export const mentorshipRequestsRelations = relations(
  mentorshipRequests,
  ({ one }) => ({
    candidate: one(candidates, {
      fields: [mentorshipRequests.candidateId],
      references: [candidates.userId],
    }),
    mentor: one(mentors, {
      fields: [mentorshipRequests.mentorId],
      references: [mentors.userId],
    }),
    candidateUser: one(user, {
      fields: [mentorshipRequests.candidateId],
      references: [user.id],
    }),
    mentorUser: one(user, {
      fields: [mentorshipRequests.mentorId],
      references: [user.id],
    }),
  }),
);

export type MentorshipRequest = typeof mentorshipRequests.$inferSelect;
export type NewMentorshipRequest = typeof mentorshipRequests.$inferInsert;
