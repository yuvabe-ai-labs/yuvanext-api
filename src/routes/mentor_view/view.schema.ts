import z from "zod";
import { candidateSnapshotSchema } from "../mentorship_request/mentorship-request.schema";

/**
 * Query schema shared by both new mentor list endpoints.
 * search → filter by candidate name (case-insensitive)
 */
export const getMentorCandidatesQuerySchema = z.object({
  search: z.string().optional().describe("Filter by candidate name"),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

/**
 * A richer candidate row returned to the mentor.
 * Includes the request id/message so the mentor can reference it.
 */
export const mentorCandidateItemSchema = z.object({
  requestId: z.string(),
  message: z.string().nullable(), // candidate's intro message
  requestedAt: z.date(), // when the request was created
  acceptedAt: z.date().nullable(), // populated only on the "accepted" endpoint
  candidate: candidateSnapshotSchema,
});

/**
 * A single application row returned to the mentor.
 * Includes which candidate submitted it so the mentor can identify them.
 */
export const mentorAcceptedCandidateApplicationItemSchema = z.object({
  applicationId: z.string(),
  status: z.enum([
    "applied",
    "shortlisted",
    "not_shortlisted",
    "interviewed",
    "hired",
  ]),
  appliedAt: z.date(),
  updatedAt: z.date(),
  profileScore: z.number().nullable(),
  candidateOfferDecision: z.enum(["accept", "reject", "pending"]),
  unitOfferDecision: z.enum(["selected", "reject", "pending"]),
  candidate: candidateSnapshotSchema,
  internship: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    duration: z.string().nullable(),
    jobType: z.enum(["part_time", "full_time", "both"]).nullable(),
    isPaid: z.boolean().nullable(),
    payment: z.string().nullable(),
    status: z.enum(["active", "closed", "draft"]),
    closingDate: z.string().nullable(),
    skillsRequired: z.array(z.string()).nullable(),
    unit: z.object({
      userId: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
      image: z.string().nullable(),
    }),
  }),
});

/**
 * Query schema for the mentor's accepted-candidates applications list.
 * search → filter by candidate name OR internship title
 * status → filter by application status
 */
export const getMentorAcceptedCandidatesApplicationsQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Filter by candidate name or internship title"),
  status: z
    .enum(["applied", "shortlisted", "not_shortlisted", "interviewed", "hired"])
    .optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

/**
 * Query schema for the unit list endpoint.
 * search → filter by unit name (case-insensitive)
 */
export const getMentorUnitsQuerySchema = z.object({
  search: z.string().optional().describe("Filter by unit name"),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

/**
 * A single row in the units list.
 * Only the summary fields needed to identify/browse units.
 */
export const mentorUnitListItemSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  type: z.string().nullable(),
  industry: z.string().nullable(),
  location: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  description: z.string().nullable(),
  isAurovillian: z.boolean().nullable(),
  // how many of this mentor's accepted candidates have applied to this unit
  applicationCount: z.number(),
});

/**
 * Full unit profile returned for a single unit detail view.
 */
export const mentorUnitProfileSchema = z.object({
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
  location: z.string().nullable(),
  focusAreas: z.array(z.string()).nullable(),
  skillsOffered: z.array(z.string()).nullable(),
  opportunitiesOffered: z.array(z.string()).nullable(),
  socialLinks: z.record(z.string(), z.string()).nullable(),
  // email from the user table
  email: z.string().nullable(),
  // image (avatar) from the user table
  image: z.string().nullable(),
});

/**
 * Query schema for the combined dashboard endpoint.
 * search → filters both candidate name AND internship title simultaneously
 * status → filters applications by status
 */
export const getMentorDashboardQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Filter by candidate name or internship title"),
  status: z
    .enum(["applied", "shortlisted", "not_shortlisted", "interviewed", "hired"])
    .optional()
    .describe("Filter applications by status"),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

/**
 * One accepted candidate row — includes their full snapshot
 * AND a nested list of all their internship applications.
 */
export const mentorDashboardCandidateSchema = z.object({
  requestId: z.string(),
  acceptedAt: z.date(),
  candidate: candidateSnapshotSchema,
  applications: z.array(mentorAcceptedCandidateApplicationItemSchema),
});

/**
 * The full dashboard response shape.
 */
export const mentorDashboardResponseSchema = z.object({
  totalAcceptedCandidates: z.number(),
  totalApplications: z.number(),
  candidates: z.array(mentorDashboardCandidateSchema),
  pagination: z.object({
    currentPage: z.number(),
    totalPages: z.number(),
    totalItems: z.number(),
    itemsPerPage: z.number(),
  }),
});

export const getHiredCandidatesQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Filter by candidate name or internship title"),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

export const mentorHiredCandidateItemSchema = z.object({
  applicationId: z.string(),
  appliedAt: z.date(),
  updatedAt: z.date(),
  candidateOfferDecision: z.enum(["accept", "reject", "pending"]),
  unitOfferDecision: z.enum(["selected", "reject", "pending"]),
  candidate: candidateSnapshotSchema,
  internship: z.object({
    id: z.string(),
    title: z.string(),
    duration: z.string().nullable(),
    jobType: z.enum(["part_time", "full_time", "both"]).nullable(),
    isPaid: z.boolean().nullable(),
    payment: z.string().nullable(),
    unit: z.object({
      userId: z.string(),
      name: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      email: z.string().nullable(),
    }),
  }),
});
