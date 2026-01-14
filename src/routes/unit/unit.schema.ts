import { z } from "zod";

// Request Schemas
export const unitIdParamSchema = z.object({
  id: z.uuid(),
});

// Internship schema for nested response
export const internshipSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  payment: z.string().nullable(),
  status: z.enum(["active", "closed", "draft"]),
  closingDate: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  isPaid: z.boolean().nullable(),
  minAgeRequired: z.string().nullable(),
  jobType: z.enum(["part_time", "full_time", "both"]).nullable(),
  benefits: z.array(z.string()).nullable(),
  skillsRequired: z.array(z.string()).nullable(),
  responsibilities: z.array(z.string()).nullable(),
  language: z.array(z.string()).nullable(),
});

// Response Schemas
export const unitResponseSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  type: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  mission: z.string().nullable(),
  values: z.string().nullable(),
  description: z.string().nullable(),
  industry: z.string().nullable(),
  isAurovillian: z.boolean().nullable(),
  bannerUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  galleryImages: z.array(z.string()).nullable(),
  galleryVideos: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  focusAreas: z.array(z.string()).nullable(),
  skillsOffered: z.array(z.string()).nullable(),
  location: z.string().nullable(),
  opportunitiesOffered: z.array(z.any()).nullable(),
  projects: z.array(z.any()).nullable(),
  socialLinks: z.record(z.string(), z.string()).nullable(),
  // User info
  email: z.email().nullable(),
  userAccountStatus: z.boolean().nullable(),
});

// Extended response schema with internships for getUnitById
export const unitWithInternshipsResponseSchema = unitResponseSchema.extend({
  internships: z.array(internshipSchema),
});
