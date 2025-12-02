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

import { applications } from "./application.schemas";
import { savedInternship } from "./saved-internship.schemas";
import { users } from "./user-schemas";

export const candidateTypeEnum = pgEnum("candidate_type", [
  "student",
  "fresher",
  "working",
  "graduate",
]);
export const maritalStatusEnum = pgEnum("marital_status", [
  "married",
  "single",
]);
export const genderEnum = pgEnum("gender", [
  "male",
  "female",
  "other",
  "prefer not to say",
]);

export const candidates = pgTable("candidates", {
  userId: uuid("user_id").primaryKey().notNull(),
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
  skills: jsonb("skills").$type<string[]>(), // JSON array of skills
  interests: jsonb("interests").$type<string[]>(), // JSON array of interests
  lookingFor: jsonb("looking_for").$type<string[]>(), // JSON array of job preferences
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  gender: genderEnum("gender"),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true, precision: 0 }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  education: jsonb("education").$type<any[]>(), // JSON array of education records
  language: jsonb("language").$type<string[]>(), // JSON array of languages
  course: jsonb("course").$type<any[]>(), // JSON array of courses
  internship: jsonb("internship").$type<any[]>(), // JSON array of internship history
  socialLinks: jsonb("social_links").$type<Record<string, string>>(),
});

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  user: one(users, {
    fields: [candidates.userId],
    references: [users.userId],
  }),
  savedInternships: many(savedInternship),
  applications: many(applications),
}));
