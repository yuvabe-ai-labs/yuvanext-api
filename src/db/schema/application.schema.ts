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

import { user } from "./auth.schema";
import { internships } from "./internship.schema";
import { interviews } from "./interview.schema";

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
  "pending",
]);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // ADD THIS

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
    includedSections: jsonb("included_sections").$type<string[]>(),
    candidateOfferDecision: candidateOfferDecisionEnum(
      "candidate_offer_decision",
    ).default("pending"),
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
    user: one(user, {
      fields: [applications.userId],
      references: [user.id],
    }),
    internship: one(internships, {
      fields: [applications.internshipId],
      references: [internships.id],
    }),
    interviews: many(interviews),
  }),
);
