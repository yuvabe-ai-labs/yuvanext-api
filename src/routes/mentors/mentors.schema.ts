import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const mentorTypeEnum = z.enum([
  "career_guidance",
  "internship_support",
  "skills_portfolio",
  "wellbeing_confidence",
  "general",
]);

export const capacityEnum = z.enum(["1-2", "3-5", "6-10", "10+"]);

// ─── Pagination (mirrors admin pattern exactly) ───────────────────────────────

export const paginationMetadataSchema = z.object({
  currentPage: z.number(),
  totalPages: z.number(),
  totalItems: z.number(),
  itemsPerPage: z.number(),
});

export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    pagination: paginationMetadataSchema,
  });

// ─── Query Schemas ────────────────────────────────────────────────────────────

export const getMentorsQuerySchema = z.object({
  // Search by mentor name or expertise area (case-insensitive)
  search: z.string().optional(),
  mentorType: mentorTypeEnum.optional(),
  expertiseArea: z.string().optional(),
  availabilityDay: z.string().optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

// ─── Item Schemas ─────────────────────────────────────────────────────────────

export const mentorListItemSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.email(),
  mentorType: mentorTypeEnum.nullable(),
  expertiseAreas: z.array(z.string()).nullable(),
  experienceSnapshot: z.string().nullable(),
});

export const detailedMentorSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.email(),
  mentorType: mentorTypeEnum.nullable(),
  expertiseAreas: z.array(z.string()).nullable(),
  experienceSnapshot: z.string().nullable(),
  availabilityDays: z.array(z.string()).nullable(),
  availabilityTimeWindows: z
    .array(z.object({ start: z.string(), end: z.string() }))
    .nullable(),
  timezone: z.string().nullable(),
  mentoringCapacity: capacityEnum.nullable(),
  preferredStages: z.array(z.string()).nullable(),
  communicationModes: z.array(z.string()).nullable(),
  confirmBoundaries: z.boolean().nullable(),
  onboardingCompleted: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
