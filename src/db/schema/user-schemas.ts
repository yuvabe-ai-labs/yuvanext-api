import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { applications } from "./application.schemas";
import { candidates } from "./candidate.schemas";
import { notifications } from "./notification.schemas";
import { units } from "./unit.schemas";

export const roleEnum = pgEnum("role", ["student", "unit"]);

export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().notNull(),
  name: text("name"),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  candidate: one(candidates, {
    fields: [users.userId],
    references: [candidates.userId],
  }),
  unit: one(units, {
    fields: [users.userId],
    references: [units.userId],
  }),
  applications: many(applications),
  notifications: many(notifications),
}));
