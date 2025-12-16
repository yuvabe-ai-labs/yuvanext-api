import { z } from "zod";

// Enums
export const InternshipStatusEnum = z.enum(["active", "closed", "draft"]);
export const JobTypeEnum = z.enum(["part_time", "full_time", "both"]);

// Request Schemas
export const CreateInternshipSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.string().optional(),
  payment: z.string().optional(),
  status: InternshipStatusEnum.default("draft"),
  closingDate: z.string().optional(),
  isPaid: z.boolean().default(false),
  minAgeRequired: z.string().optional(),
  jobType: JobTypeEnum.optional(),
  benefits: z.array(z.string()).optional(),
  skillsRequired: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
});

export const UpdateInternshipSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    duration: z.string().optional(),
    payment: z.string().optional(),
    status: InternshipStatusEnum.optional(),
    closingDate: z.string().optional(),
    isPaid: z.boolean().optional(),
    minAgeRequired: z.string().optional(),
    jobType: JobTypeEnum.optional(),
    benefits: z.array(z.string()).optional(),
    skillsRequired: z.array(z.string()).optional(),
    responsibilities: z.array(z.string()).optional(),
    language: z.array(z.string()).optional(),
  })
  .partial();

export const InternshipIdParamSchema = z.object({
  id: z.uuid(),
});

// Response Schemas
export const InternshipResponseSchema = z.object({
  id: z.uuid(),
  createdBy: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  payment: z.string().nullable(),
  status: InternshipStatusEnum,
  closingDate: z.union([z.string(), z.date()]).nullable(),
  isPaid: z.boolean(),
  minAgeRequired: z.string().nullable(),
  jobType: JobTypeEnum.nullable(),
  benefits: z.array(z.string()).nullable(),
  skillsRequired: z.array(z.string()).nullable(),
  responsibilities: z.array(z.string()).nullable(),
  language: z.array(z.string()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const RecommendedInternshipResponseSchema =
  InternshipResponseSchema.extend({
    matchScore: z.number(),
    matchedKeywords: z.array(z.string()),
    combinedText: z.string(),
  });

export const RecommendedInternshipsDataSchema = z.object({
  internships: z.array(RecommendedInternshipResponseSchema),
  totalMatches: z.number(),
  profileKeywords: z.array(z.string()),
});

export const UnitStatsResponseSchema = z.object({
  totalInternships: z.number(),
  totalApplications: z.number(),
  totalInterviews: z.number(),
  hiredThisMonth: z.number(),
  period: z.object({
    month: z.string(),
    year: z.number(),
  }),
});
