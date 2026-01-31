import { z } from "zod";

// Enums
export const internshipStatusEnum = z.enum(["active", "closed", "draft"]);
export const jobTypeEnum = z.enum(["part_time", "full_time", "both"]);

// Request Schemas
export const createInternshipSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.string().optional(),
  payment: z.string().optional(),
  status: internshipStatusEnum.default("draft"),
  closingDate: z.string().optional(),
  isPaid: z.boolean().default(false),
  minAgeRequired: z.string().optional(),
  jobType: jobTypeEnum.optional(),
  benefits: z.array(z.string()).optional(),
  skillsRequired: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
  createdBy: z.uuid().optional(),
});

export const updateInternshipSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    duration: z.string().optional(),
    payment: z.string().optional(),
    status: internshipStatusEnum.optional(),
    closingDate: z.string().optional(),
    isPaid: z.boolean().optional(),
    minAgeRequired: z.string().optional(),
    jobType: jobTypeEnum.optional(),
    benefits: z.array(z.string()).optional(),
    skillsRequired: z.array(z.string()).optional(),
    responsibilities: z.array(z.string()).optional(),
    language: z.array(z.string()).optional(),
  })
  .partial();

export const internshipIdParamSchema = z.object({
  id: z.uuid(),
});

export const createdByMetadataSchema = z.object({
  userId: z.uuid().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  description: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  location: z.string().nullable(),
});

// Response Schemas
export const internshipResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  payment: z.string().nullable(),
  status: internshipStatusEnum,
  closingDate: z.union([z.string(), z.date()]).nullable(),
  isPaid: z.boolean(),
  minAgeRequired: z.string().nullable(),
  jobType: jobTypeEnum.nullable(),
  benefits: z.array(z.string()).nullable(),
  skillsRequired: z.array(z.string()).nullable(),
  responsibilities: z.array(z.string()).nullable(),
  language: z.array(z.string()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  applicationCount: z.number().optional(),
  createdBy: createdByMetadataSchema,
});

export const recommendedinternshipResponseSchema =
  internshipResponseSchema.extend({
    matchScore: z.number(),
    matchedKeywords: z.array(z.string()),
    combinedText: z.string(),
  });

export const recommendedInternshipsDataSchema = z.object({
  internships: z.array(recommendedinternshipResponseSchema),
  totalMatches: z.number(),
  profileKeywords: z.array(z.string()),
});

export const unitStatsResponseSchema = z.object({
  totalInternships: z.number(),
  totalApplications: z.number(),
  totalInterviews: z.number(),
  hiredThisMonth: z.number(),
  totalActiveInternships: z.number(),
  totalHiredCandidates: z.number(),
  period: z.object({
    month: z.string(),
    year: z.number(),
  }),
});
