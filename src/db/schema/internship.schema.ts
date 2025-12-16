import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { applications } from "./application.schema";
import { savedInternship } from "./saved-internship.schema";
import { units } from "./unit.schema";

export const internshipStatusEnum = pgEnum("internship_status", [
  "active",
  "closed",
  "draft",
]);
export const jobTypeEnum = pgEnum("job_type", [
  "part_time",
  "full_time",
  "both",
]);

export const internships = pgTable(
  "internships",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => units.userId, { onDelete: "cascade" }), // OR "set null"
    title: text("title").notNull(),
    description: text("description"),
    duration: text("duration"),
    payment: text("payment"),
    status: internshipStatusEnum("status").notNull().default("draft"),
    closingDate: date("closing_date"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 0,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      precision: 0,
    }).defaultNow(),
    isPaid: boolean("is_paid").default(false),
    minAgeRequired: text("min_age_required"),
    jobType: jobTypeEnum("job_type"),
    benefits: jsonb("benefits").$type<string[]>(),
    skillsRequired: jsonb("skills_required").$type<string[]>(),
    responsibilities: jsonb("responsibilities").$type<string[]>(),
    language: jsonb("language").$type<string[]>(),
  },
  (table) => ({
    createdByIdx: index("internships_created_by_index").on(table.createdBy),
    statusIdx: index("internships_status_index").on(table.status),
    statusClosingDateIdx: index("internships_status_closing_date_index").on(
      table.status,
      table.closingDate,
    ),
  }),
);

export const internshipsRelations = relations(internships, ({ one, many }) => ({
  creator: one(units, {
    fields: [internships.createdBy],
    references: [units.userId],
  }),
  applications: many(applications),
  savedBy: many(savedInternship),
}));
