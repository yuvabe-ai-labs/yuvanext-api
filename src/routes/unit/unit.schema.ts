import { z } from "zod";

// Request Schemas
export const UnitIdParamSchema = z.object({
  id: z.uuid(),
});

// Response Schemas
export const UnitResponseSchema = z.object({
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
  userImage: z.string().nullable(),
});
