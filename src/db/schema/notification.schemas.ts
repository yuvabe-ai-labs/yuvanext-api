import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

export const notificationTypeEnum = pgEnum("notification_type", [
  "success",
  "info",
  "warning",
  "error",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // ADD THIS
    title: text("title"),
    message: text("message"),
    type: notificationTypeEnum("type").default("info"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("notifications_user_id_index").on(table.userId),
    isReadIdx: index("notifications_is_read_index").on(table.isRead),
    userIdIsReadIdx: index("notifications_user_id_is_read_index").on(
      table.userId,
      table.isRead,
    ),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));
