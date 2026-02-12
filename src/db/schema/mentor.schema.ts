import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

export const mentorTypeEnum = pgEnum("mentor_type", [
  "career_guidance",
  "internship_support",
  "skills_portfolio",
  "wellbeing_confidence",
  "general",
]);

export const capacityEnum = pgEnum("capacity", ["1-2", "3-5", "6-10", "10+"]);

export const mentors = pgTable("mentors", {
  userId: uuid("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  mentorType: mentorTypeEnum("mentor_type"),
  expertiseAreas: jsonb("expertise_areas").$type<string[]>(),
  experienceSnapshot: text("experience_snapshot"),

  // Availability
  availabilityDays: jsonb("availability_days").$type<string[]>(), // ["Monday", "Tuesday", ...]
  availabilityTimeWindows: jsonb("availability_time_windows").$type<
    Array<{ start: string; end: string }>
  >(), // [{ start: "09:00", end: "12:00" }, ...]
  timezone: text("timezone"), // "UTC", "IST", etc.

  // Capacity & Preferences
  mentoringCapacity: capacityEnum("mentoring_capacity"),
  preferredStages: jsonb("preferred_stages").$type<string[]>(), // ["Stage 1: Foundations", ...]
  communicationModes: jsonb("communication_modes").$type<string[]>(), // ["Messaging", "Calls", "Meetings", "Video"]

  // Boundaries & Acknowledgements
  confirmBoundaries: boolean("confirm_boundaries").default(false),

  // Metadata
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
});

export const mentorsRelations = relations(mentors, ({ one }) => ({
  user: one(user, {
    fields: [mentors.userId],
    references: [user.id],
  }),
}));
