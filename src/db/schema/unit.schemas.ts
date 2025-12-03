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
import { courses } from "./course.schemas";
import { internships } from "./internship.schemas";
import { savedInternship } from "./saved-internship.schemas";

export const units = pgTable("units", {
  userId: uuid("user_id").primaryKey().notNull(),
  name: text("name"),
  type: text("type"),
  phone: text("phone"),
  address: text("address"),
  websiteUrl: text("website_url"),
  mission: text("mission"),
  values: text("values"),
  description: text("description"),
  industry: text("industry"),
  isAurovillian: boolean("is_aurovillian").default(false),
  bannerUrl: text("banner_url"),
  avatarUrl: text("avatar_url"),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]), // JSON array of image URLs
  galleryVideos: jsonb("gallery_videos").$type<string[]>().default([]), // JSON array of video URLs
  createdAt: timestamp("created_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 0 })
    .notNull()
    .defaultNow(),
  focusAreas: jsonb("focus_areas").$type<string[]>(), // JSON array of focus areas
  skillsOffered: jsonb("skills_offered").$type<string[]>(), // JSON array of skills offered
  opportunitiesOffered: jsonb("opportunities_offered").$type<string[]>(), // JSON array of opportunities
  location: text("location"),
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
