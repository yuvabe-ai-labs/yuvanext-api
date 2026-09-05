import { z } from "zod";

export const meetingStatusEnum = z.enum(["pending", "completed", "cancelled"]);

export const meetingPurposeEnum = z.enum([
  "weekly_check_in",
  "progress_review",
  "mid_point_evaluation",
  "final_assessment",
  "other",
]);

export const meetingTypeEnum = z.enum(["zoom", "in_person"]);

function isOfficeHours(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return day >= 1 && day <= 5 && totalMinutes >= 540 && totalMinutes <= 1020;
}

// ─── Request Schemas ──────────────────────────────────────────────────────────

export const createMeetingSchema = z
  .object({
    candidateId: z.uuid("Invalid candidate ID"),
    mentorId: z.uuid().optional(),
    purpose: meetingPurposeEnum,
    meetingType: meetingTypeEnum,
    scheduledAt: z
      .string()
      .datetime({ message: "Must be a valid ISO 8601 datetime" }),
    durationMinutes: z
      .number()
      .int()
      .positive()
      .max(480, "Duration cannot exceed 8 hours")
      .default(30)
      .optional(),
    description: z // renamed from agenda
      .string()
      .max(1000, "Description must be 1000 characters or fewer")
      .optional(),
    location: z
      .string()
      .max(500, "Location must be 500 characters or fewer")
      .optional(),
  })
  .refine(
    (data) => {
      // location is required when meetingType is in_person
      if (data.meetingType === "in_person") {
        return !!data.location && data.location.trim().length > 0;
      }
      return true;
    },
    {
      message: "Location is required for in-person meetings.",
      path: ["location"],
    },
  );

export const cancelMeetingSchema = z.object({
  meetingId: z.uuid("Invalid meeting ID"),
  cancellationReason: z // now optional
    .string()
    .max(500, "Cancellation reason must be 500 characters or fewer")
    .optional(),
});

export const getMeetingsQuerySchema = z.object({
  search: z.string().optional().describe("Filter by candidate name"),
  status: meetingStatusEnum.optional(),
  purpose: meetingPurposeEnum.optional(),
  meetingType: meetingTypeEnum.optional().describe("Filter by meeting type"),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

// ─── Response Schemas ─────────────────────────────────────────────────────────

export const meetingItemSchema = z.object({
  id: z.string(),
  purpose: meetingPurposeEnum,
  meetingType: meetingTypeEnum,
  status: meetingStatusEnum,
  scheduledAt: z.date(),
  durationMinutes: z.string().nullable(),
  description: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  location: z.string().nullable(),
  zoomJoinUrl: z.string().nullable(),
  zoomStartUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  /** Unit behind the candidate's most recent application; null if they have none. */
  unitName: z.string().nullable(),
  candidate: z.object({
    userId: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    profileSummary: z.string().nullable(),
    skills: z.array(z.string()).nullable(),
    experienceLevel: z.string().nullable(),
  }),
});

export const createMeetingResponseSchema = z.object({
  id: z.string(),
  mentorId: z.string(),
  candidateId: z.string(),
  purpose: meetingPurposeEnum,
  meetingType: meetingTypeEnum,
  status: meetingStatusEnum,
  scheduledAt: z.date(),
  durationMinutes: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  zoomJoinUrl: z.string().nullable(),
  zoomStartUrl: z.string().nullable(),
  zoomCreated: z.boolean(),
  createdAt: z.date(),
});

export const cancelMeetingResponseSchema = z.object({
  id: z.string(),
  status: meetingStatusEnum,
  cancellationReason: z.string().nullable(),
  zoomCancelled: z.boolean(),
  notificationSent: z.boolean(),
  emailSent: z.boolean(),
  updatedAt: z.date(),
});

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
