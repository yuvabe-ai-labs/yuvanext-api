import { z } from "zod";

// Enums from the mentor schema
export const mentorTypeEnum = z.enum([
  "career_guidance",
  "internship_support",
  "skills_portfolio",
  "wellbeing_confidence",
  "general",
]);

export const capacityEnum = z.enum(["1-2", "3-5", "6-10", "10+"]);

// Request Schemas
export const getMentorsQuerySchema = z.object({
  mentorType: mentorTypeEnum.optional(),
  expertiseArea: z.string().optional(),
  availabilityDay: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// Response Schemas
export const mentorListItemSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
  mentorType: mentorTypeEnum.nullable(),
  expertiseAreas: z.array(z.string()).nullable(),
  experienceSnapshot: z.string().nullable(),
  availabilityDays: z.array(z.string()).nullable(),
  availabilityTimeWindows: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
      }),
    )
    .nullable(),
  timezone: z.string().nullable(),
  mentoringCapacity: capacityEnum.nullable(),
  preferredStages: z.array(z.string()).nullable(),
  communicationModes: z.array(z.string()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
});

export const detailedMentorSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
  mentorType: mentorTypeEnum.nullable(),
  expertiseAreas: z.array(z.string()).nullable(),
  experienceSnapshot: z.string().nullable(),
  availabilityDays: z.array(z.string()).nullable(),
  availabilityTimeWindows: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
      }),
    )
    .nullable(),
  timezone: z.string().nullable(),
  mentoringCapacity: capacityEnum.nullable(),
  preferredStages: z.array(z.string()).nullable(),
  communicationModes: z.array(z.string()).nullable(),
  confirmBoundaries: z.boolean().nullable(),
  onboardingCompleted: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const getMentorsResponseSchema = z.object({
  status_code: z.number(),
  message: z.string(),
  data: z.array(mentorListItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export const getMentorByIdResponseSchema = z.object({
  status_code: z.number(),
  message: z.string(),
  data: detailedMentorSchema,
});
