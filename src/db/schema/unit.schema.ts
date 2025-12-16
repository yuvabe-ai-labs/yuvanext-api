import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema";
import { courses } from "./course.schema";
import { internships } from "./internship.schema";
import { savedInternship } from "./saved-internship.schema";

export const units = pgTable("units", {
  userId: uuid("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }), // ADD THIS
  name: text("name"),
  type: text("type"),
  phone: text("phone"),
  address: text("address"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  websiteUrl: text("website_url"),
  mission: text("mission"),
  values: text("values"),
  description: text("description"),
  industry: text("industry"),
  isAurovillian: boolean("is_aurovillian").default(false),
  bannerUrl: text("banner_url"),
  avatarUrl: text("avatar_url"),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),
  galleryVideos: jsonb("gallery_videos").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  focusAreas: jsonb("focus_areas").$type<string[]>(),
  skillsOffered: jsonb("skills_offered").$type<string[]>(),
  location: text("location"),
  opportunitiesOffered: jsonb("opportunities_offered").$type<string[]>(),
  projects: jsonb("projects").$type<any[]>(),
  socialLinks: jsonb("social_links").$type<Record<string, string>>(),
});

export const unitsRelations = relations(units, ({ one, many }) => ({
  user: one(user, {
    fields: [units.userId],
    references: [user.id],
  }),
  internships: many(internships),
  courses: many(courses),
  savedInternships: many(savedInternship),
}));
