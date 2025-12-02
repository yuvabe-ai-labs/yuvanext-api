import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { applications } from "./application.schemas";

export const interviewProviderEnum = pgEnum("interview_provider", [
  "zoom",
  "google_meet",
  "teams",
  "other",
]);

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id),
    scheduledDate: timestamp("scheduled_date", {
      withTimezone: true,
      precision: 0,
    }).notNull(),
    durationMinutes: smallint("duration_minutes"),
    link: text("link"),
    title: text("title"),
    description: text("description"),
    provider: interviewProviderEnum("provider"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 0,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      precision: 0,
    }).defaultNow(),
  },
  (table) => ({
    applicationIdIdx: index("interviews_application_id_index").on(
      table.applicationId,
    ),
  }),
);

export const interviewsRelations = relations(interviews, ({ one }) => ({
  application: one(applications, {
    fields: [interviews.applicationId],
    references: [applications.id],
  }),
}));
