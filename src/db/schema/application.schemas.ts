import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { internships } from "./internship.schemas";
import { interviews } from "./interview.schemas";
import { users } from "./user-schemas";

export const applicationStatusEnum = pgEnum("application_status", [
  "applied",
  "shortlisted",
  "rejected",
  "interviewed",
  "hired",
]);

export const candidateOfferDecisionEnum = pgEnum("candidate_offer_decision", [
  "accept",
  "reject",
]);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    internshipId: uuid("internship_id").references(() => internships.id),
    status: applicationStatusEnum("status").default("applied"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 0,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      precision: 0,
    }).defaultNow(),
    profileScore: smallint("profile_score"),
    includedSections: jsonb("included_sections").$type<string[]>(), // JSON array of profile sections included in application
    candidateOfferDecision: candidateOfferDecisionEnum(
      "candidate_offer_decision",
    ),
  },
  (table) => ({
    userIdIdx: index("applications_user_id_index").on(table.userId),
    internshipIdIdx: index("applications_internship_id_index").on(
      table.internshipId,
    ),
    statusIdx: index("applications_status_index").on(table.status),
    userIdStatusIdx: index("applications_user_id_status_index").on(
      table.userId,
      table.status,
    ),
  }),
);

export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    user: one(users, {
      fields: [applications.userId],
      references: [users.userId],
    }),
    internship: one(internships, {
      fields: [applications.internshipId],
      references: [internships.id],
    }),
    interviews: many(interviews),
  }),
);
