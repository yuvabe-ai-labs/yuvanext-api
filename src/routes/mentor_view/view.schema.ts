import z from "zod";
import { candidateSnapshotSchema } from "../mentorship_request/mentorship-request.schema";

/**
 * Query schema for the mentor accepted-candidates list.
 *
 * filter:
 *   "recent" → return the 10 most-recently accepted candidates (no pagination)
 *   "all"    → return all accepted candidates with full pagination (default)
 *   "unit"   → return accepted candidates who have applied to the given unitId
 *
 * unitId is required when filter = "unit".
 * search → filter by candidate name (case-insensitive, applied on all modes).
 */
export const getMentorCandidatesQuerySchema = z
  .object({
    filter: z
      .enum(["recent", "all", "unit"])
      .default("all")
      .optional()
      .describe(
        '"recent" = last 10 accepted; "all" = paginated list; "unit" = candidates who applied to unitId',
      ),
    unitId: z
      .string()
      .uuid("unitId must be a valid UUID")
      .optional()
      .describe("Required when filter = \'unit\'"),
    search: z.string().optional().describe("Filter by candidate name"),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
  })
  .refine((val) => val.filter !== "unit" || !!val.unitId, {
    message: "unitId is required when filter is \'unit\'",
    path: ["unitId"],
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

/**
 * A single row: one of the mentor's accepted candidates who applied to the unit,
 * with the specific internship they applied to and their application status.
 */
export const mentorUnitCandidateItemSchema = z.object({
  applicationId: z.string(),
  applicationStatus: z.enum([
    "applied",
    "shortlisted",
    "not_shortlisted",
    "interviewed",
    "hired",
  ]),
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
    status: z.enum(["active", "closed", "draft"]),
  }),
});

/**
 * A single stat tile: total count + how many are new this calendar month.
 */
export const statTileSchema = z.object({
  total: z.number().describe("All-time total count"),
  newThisMonth: z
    .number()
    .describe(
      "Count of items created / scheduled in the current calendar month",
    ),
});

/**
 * Full response for GET /mentor/stats
 */
export const mentorStatsResponseSchema = z.object({
  pendingRequests: statTileSchema.describe(
    "Mentorship requests with status 'pending' sent to this mentor",
  ),
  acceptedMentees: statTileSchema.describe(
    "Candidates whose mentorship request the mentor accepted",
  ),
  menteeUnitCount: statTileSchema.describe(
    "Unique units (companies) that accepted mentees have applied to",
  ),
  upcomingMeetings: statTileSchema.describe(
    "Pending meetings whose scheduledAt is in the future",
  ),
  hiredApplications: statTileSchema.describe(
    "Applications with status = 'hired' submitted by accepted mentees",
  ),
});

/**
 * Query schema for the mentee-growth series.
 *
 * months → how many months back the series covers, current month included.
 */
export const menteeGrowthQuerySchema = z.object({
  months: z.coerce.number().int().positive().max(24).default(6).optional(),
});

/** One bucket of the mentee-growth series. Months with no joins return 0. */
export const menteeGrowthPointSchema = z.object({
  month: z.string().describe("Start of the month, as YYYY-MM"),
  label: z.string().describe("Short month name, e.g. 'Apr'"),
  year: z.number(),
  count: z.number().describe("Mentees whose request was accepted that month"),
});

export const menteeGrowthResponseSchema = z.object({
  months: z.array(menteeGrowthPointSchema),
  total: z.number().describe("Sum across the returned window"),
});
