import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { units } from "./unit.schemas";

export const difficultyLevelEnum = pgEnum("difficulty_level", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  duration: text("duration"),
  category: text("category"),
  difficultyLevel: difficultyLevelEnum("difficulty_level"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => units.userId, { onDelete: "cascade" }), // OR "set null" if you want to keep courses
  bannerUrl: text("banner_url"),
  redirectUrl: text("redirect_url"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
});

export const coursesRelations = relations(courses, ({ one }) => ({
  creator: one(units, {
    fields: [courses.createdBy],
    references: [units.userId],
  }),
}));
