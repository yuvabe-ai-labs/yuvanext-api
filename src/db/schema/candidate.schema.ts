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

import { applications } from "./application.schema";
import { user } from "./auth.schema";
import { savedInternship } from "./saved-internship.schema";

export const candidateTypeEnum = pgEnum("candidate_type", [
  "student",
  "fresher",
  "working",
  "graduate",
]);
export const maritalStatusEnum = pgEnum("marital_status", [
  "married",
  "single",
  "prefer not to say",
]);
export const genderEnum = pgEnum("gender", [
  "male",
  "female",
  "other",
  "prefer not to say",
]);

export const candidates = pgTable("candidates", {
  userId: uuid("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }), // ADD THIS
  type: candidateTypeEnum("type"),
  experienceLevel: text("experience_level"),
  profileSummary: text("profile_summary"),
  location: text("location"),
  maritalStatus: maritalStatusEnum("marital_status"),
  isDifferentlyAbled: boolean("is_differently_abled").default(false),
  hasCareerBreak: boolean("has_career_break").default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    precision: 0,
  }).defaultNow(),
  skills: jsonb("skills").$type<string[]>(),
  interests: jsonb("interests").$type<string[]>(),
  lookingFor: jsonb("looking_for").$type<string[]>(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  gender: genderEnum("gender"),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true, precision: 0 }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  education: jsonb("education").$type<any[]>(),
  language: jsonb("language").$type<string[]>(),
  course: jsonb("course").$type<any[]>(),
  internship: jsonb("internship").$type<any[]>(),
  projects: jsonb("projects").$type<any[]>(),

  socialLinks: jsonb("social_links").$type<Record<string, string>>(),
});

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  user: one(user, {
    fields: [candidates.userId],
    references: [user.id],
  }),
  savedInternships: many(savedInternship),
  applications: many(applications),
}));
