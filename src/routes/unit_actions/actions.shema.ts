import { z } from "zod";

// Enums
export const applicationStatusEnum = z.enum([
  "applied",
  "shortlisted",
  "not_shortlisted",
  "interviewed",
  "hired",
]);

export const candidateOfferDecisionEnum = z.enum([
  "accept",
  "reject",
  "pending",
]);

export const interviewProviderEnum = z.enum([
  "zoom",
  "google_meet",
  "teams",
  "other",
]);

// Request Schemas
export const updateApplicationStatusSchema = z.object({
  applicationId: z.uuid(),
  status: applicationStatusEnum,
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
      provider: interviewProviderEnum.optional(),
    })
    .optional()
    .describe("Required when status is 'interviewed'"),
});

// Response Schemas
export const applicationResponseSchema = z.object({
  application: z.object({
    id: z.string(),
    status: applicationStatusEnum,
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
    candidateOfferDecision: candidateOfferDecisionEnum,
  }),
  internship: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string().nullable(),
  }),
  candidate: z.object({
    userId: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    skills: z.array(z.string()).nullable(),
    profileSummary: z.string().nullable(),
    interests: z.array(z.string()).nullable(),
  }),
});

export const detailedApplicationResponseSchema = z.object({
  application: z.object({
    id: z.string(),
    status: applicationStatusEnum,
    candidateOfferDecision: candidateOfferDecisionEnum,
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

export const interviewResponseSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  scheduledDate: z.date(),
  durationMinutes: z.number(),
  link: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  provider: interviewProviderEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateApplicationStatusResponseSchema = z.object({
  application: z.object({
    id: z.string(),
    status: applicationStatusEnum,
    updatedAt: z.union([z.string(), z.date()]),
  }),
  interview: interviewResponseSchema.optional(),
  notificationSent: z.boolean(),
  candidateEmailSent: z.boolean(),
  unitEmailSent: z.boolean().optional(),
});

export const getApplicationsResponseSchema = z
  .object({
    total: z.number(),
  })
  .catchall(z.any()); // Allows for the data array to be included

export const candidateProfileResponseSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  skills: z.array(z.string()).nullable(),
  profileSummary: z.string().nullable(),
  interests: z.array(z.string()).nullable(),
  location: z.string().nullable(),
  phone: z.string().nullable(),
  experienceLevel: z.string().nullable(),
  education: z.array(z.any()).nullable(),
  course: z.array(z.any()).nullable(),
  socialLinks: z.record(z.string(), z.string()).nullable(),
  internship: z.array(z.any()).nullable(),
  projects: z.array(z.any()).nullable(),
  /** Every internship this candidate has applied to, newest first. */
  applicationHistory: z.array(
    z.object({
      applicationId: z.string(),
      status: applicationStatusEnum,
      internshipTitle: z.string().nullable(),
      unitName: z.string().nullable(),
      unitLogoUrl: z.string().nullable(),
      appliedAt: z.union([z.string(), z.date()]).nullable(),
    }),
  ),
});

export const applicationByInternshipResponseSchema = z.object({
  applicationId: z.string(),
  candidateName: z.string(),
  candidateAvatarUrl: z.string().nullable(),
  internshipTitle: z.string(),
  status: applicationStatusEnum,
  profileSummary: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  candidateSkills: z.array(z.string()).nullable(),
  candidateInterests: z.array(z.string()).nullable(),
});
