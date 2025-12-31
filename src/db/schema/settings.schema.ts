import { relations } from "drizzle-orm";
import { boolean, index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

// =====================================================
// USER SETTINGS TABLE
// =====================================================

export const userSettings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Notification preferences
    emailNotificationsEnabled: boolean("email_notifications_enabled")
      .notNull()
      .default(true),
    inAppNotificationsEnabled: boolean("in_app_notifications_enabled")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_settings_userId_idx").on(table.userId)],
);

// =====================================================
// RELATIONS
// =====================================================

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));
