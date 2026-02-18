import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const mentorshipRequestStatusEnum = z.enum([
  "pending",
  "accepted",
  "rejected",
  "cancelled",
]);

export const mentorTypeEnum = z.enum([
  "career_guidance",
  "internship_support",
  "skills_portfolio",
  "wellbeing_confidence",
  "general",
]);

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

/**
 * Candidate: list own requests
 * search  → filters by mentor name (case-insensitive)
 * status  → filters by request status
 */
export const getCandidateRequestsQuerySchema = z.object({
  search: z.string().optional().describe("Filter by mentor name"),
  status: mentorshipRequestStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

/**
 * Mentor: list incoming requests
 * search  → filters by candidate name (case-insensitive)
 * status  → filters by request status
 */
export const getMentorRequestsQuerySchema = z.object({
  search: z.string().optional().describe("Filter by candidate name"),
  status: mentorshipRequestStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

// ─── Request Body Schemas ─────────────────────────────────────────────────────

export const createMentorshipRequestSchema = z.object({
  mentorId: z.string().uuid("Invalid mentor ID"),
  message: z
    .string()
    .max(500, "Message must be 500 characters or fewer")
    .optional()
    .describe("Optional personal message to the mentor"),
});

export const respondToMentorshipRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  action: z.enum(["accept", "reject"]),
  rejectionReason: z
    .string()
    .max(300, "Rejection reason must be 300 characters or fewer")
    .optional()
    .describe("Optional reason shown to the candidate when rejecting"),
});

// ─── Snapshot Sub-schemas ─────────────────────────────────────────────────────

export const mentorSnapshotSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
  image: z.string().nullable(),
  mentorType: mentorTypeEnum.nullable(),
  expertiseAreas: z.array(z.string()).nullable(),
  experienceSnapshot: z.string().nullable(),
});

export const candidateSnapshotSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  profileSummary: z.string().nullable(),
  skills: z.array(z.string()).nullable(),
  experienceLevel: z.string().nullable(),
});

// ─── List Item Schemas (rows inside paginated results) ────────────────────────

/** Row returned to a candidate listing their own requests */
export const candidateRequestItemSchema = z.object({
  id: z.string(),
  status: mentorshipRequestStatusEnum,
  message: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  mentor: mentorSnapshotSchema,
});

/** Row returned to a mentor listing incoming requests */
export const mentorRequestItemSchema = z.object({
  id: z.string(),
  status: mentorshipRequestStatusEnum,
  message: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  candidate: candidateSnapshotSchema,
});

// ─── Action Response Schemas ──────────────────────────────────────────────────

/** Response after successfully creating a request */
export const createMentorshipRequestResponseSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  mentorId: z.string(),
  status: mentorshipRequestStatusEnum,
  message: z.string().nullable(),
  createdAt: z.date(),
});

/**
 * Response after cancelling / accepting / rejecting.
 * autoRejectedCount is only present on accept — shows how many of the
 * candidate's other pending requests were auto-rejected.
 */
export const mentorshipRequestActionResponseSchema = z.object({
  id: z.string(),
  status: mentorshipRequestStatusEnum,
  updatedAt: z.date(),
  autoRejectedCount: z.number().optional(),
});
