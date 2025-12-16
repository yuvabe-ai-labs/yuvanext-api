import { z } from "zod";

// Enums
export const ApplicationStatusEnum = z.enum([
  "applied",
  "shortlisted",
  "rejected",
  "interviewed",
  "hired",
]);

export const CandidateOfferDecisionEnum = z.enum([
  "accept",
  "reject",
  "pending",
]);

export const InterviewProviderEnum = z.enum([
  "zoom",
  "google_meet",
  "teams",
  "other",
]);

// Request Schemas
export const UpdateApplicationStatusSchema = z.object({
  applicationId: z.string().uuid(),
  status: ApplicationStatusEnum,
  interviewDetails: z
    .object({
      scheduledAt: z
        .string()
        .datetime()
        .optional()
        .describe("ISO 8601 datetime for interview"),
      meetingLink: z.string().url().optional().describe("Zoom or meeting link"),
      notes: z.string().optional().describe("Additional notes"),
      durationMinutes: z
        .number()
        .int()
        .positive()
        .optional()
        .default(60)
        .describe("Interview duration in minutes"),
      provider: InterviewProviderEnum.optional(),
    })
    .optional()
    .describe("Required when status is 'interviewed'"),
});

// Response Schemas
export const ApplicationResponseSchema = z.object({
  application: z.object({
    id: z.string(),
    status: ApplicationStatusEnum,
    profileScore: z.number().nullable(),
    candidateOfferDecision: CandidateOfferDecisionEnum,
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
  }),
  internship: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string().nullable(),
    duration: z.string().nullable(),
  }),
  candidate: z.object({
    userId: z.string(),
    name: z.string(),
    email: z.string().email(),
    image: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    type: z.string().nullable(),
    location: z.string().nullable(),
    phone: z.string().nullable(),
    skills: z.array(z.string()).nullable(),
    experienceLevel: z.string().nullable(),
    profileSummary: z.string().nullable(),
    interests: z.array(z.string()).nullable(),
    education: z.array(z.any()).nullable(),
    course: z.array(z.any()).nullable(),
    socialLinks: z.record(z.string(), z.string()).nullable(),
    internship: z.array(z.any()).nullable(),
    projects: z.array(z.any()).nullable(),
  }),
});

export const InterviewResponseSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  scheduledDate: z.date(),
  durationMinutes: z.number(),
  link: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  provider: InterviewProviderEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UpdateApplicationStatusResponseSchema = z.object({
  application: z.object({
    id: z.string(),
    status: ApplicationStatusEnum,
    updatedAt: z.union([z.string(), z.date()]),
  }),
  interview: InterviewResponseSchema.optional(),
  notificationSent: z.boolean(),
  candidateEmailSent: z.boolean(),
  unitEmailSent: z.boolean().optional(),
});

export const GetApplicationsResponseSchema = z
  .object({
    total: z.number(),
  })
  .catchall(z.any()); // Allows for the data array to be included
