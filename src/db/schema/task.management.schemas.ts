import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { applications } from "./application.schemas";
import { user } from "./auth.schema";

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "submitted",
  "redo",
  "accepted",
]);

export const tasks = pgTable(
  "tasks_management",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: taskStatusEnum("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      precision: 0,
    }),
    reviewedBy: uuid("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewRemarks: text("review_remarks"),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      precision: 0,
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 0,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      precision: 0,
    })
      .notNull()
      .defaultNow(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    color: text("color").default("#3B82F6"),
    submissionLink: text("submission_link"),
  },
  (table) => ({
    applicationIdIdx: index("tasks_application_id_index").on(
      table.applicationId,
    ),
    statusIdx: index("tasks_status_index").on(table.status),
    reviewedByIdx: index("tasks_reviewed_by_index").on(table.reviewedBy),
  }),
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  application: one(applications, {
    fields: [tasks.applicationId],
    references: [applications.id],
  }),
  reviewer: one(user, {
    fields: [tasks.reviewedBy],
    references: [user.id],
  }),
}));
