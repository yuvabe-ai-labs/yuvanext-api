import { z } from "zod";

// =====================================================
// QUERY PARAMETER SCHEMAS
// =====================================================

export const candidateQuerySchema = z.object({
  filter: z
    .enum(["recent", "all", "applied", "hired", "shortlisted"])
    .optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

export const unitQuerySchema = z.object({
  filter: z.enum(["recent", "active"]).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

export const applicationQuerySchema = z.object({
  filter: z.enum(["recent", "interview"]).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

// =====================================================
// PARAMETER SCHEMAS
// =====================================================

export const candidateIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const unitIdParamSchema = z.object({
  id: z.string().uuid(),
});

// =====================================================
// RESPONSE SCHEMAS
// =====================================================

// 1. Overall Stats Response
export const overallStatsResponseSchema = z.object({
  totalUnits: z.number(),
  totalCandidates: z.number(),
  totalActiveInternships: z.number(),
  totalCourses: z.number(),
  totalHiredCandidates: z.number(),
  healthPercentage: z.number().default(97),
});

// 2. Recent Candidates Response
export const recentCandidateSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  type: z.enum(["student", "fresher", "working", "graduate"]).nullable(),
  location: z.string().nullable(),
});

// 3. Recent Units Response
export const recentUnitSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  address: z.string().nullable(),
});

// 5. Active Units with Stats Response
export const activeUnitWithStatsSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  totalApplications: z.number(),
  totalActiveInternships: z.number(),
});

// 6. Recent Applied Candidates Response
export const recentAppliedCandidateSchema = z.object({
  applicationId: z.string(),
  candidateId: z.string(),
  candidateName: z.string().nullable(),
  candidateAvatar: z.string().nullable(),
  internshipTitle: z.string(),
  applicationStatus: z.enum([
    "applied",
    "shortlisted",
    "not_shortlisted",
    "interviewed",
    "hired",
  ]),
  appliedAt: z.date(),
  unitName: z.string().nullable(),
});

// 8. Applied Candidates with Pagination Response
export const appliedCandidateSchema = z.object({
  candidateId: z.string(),
  avatarUrl: z.string().nullable(),
  name: z.string().nullable(),
  internshipName: z.string(),
  applicationStatus: z.enum([
    "applied",
    "shortlisted",
    "not_shortlisted",
    "interviewed",
    "hired",
  ]),
  skills: z.array(z.string()).nullable(),
  interests: z.array(z.string()).nullable(),
});

// 9. Hired Candidates Response
export const hiredCandidateSchema = z.object({
  candidateId: z.string(),
  avatarUrl: z.string().nullable(),
  name: z.string().nullable(),
  internshipName: z.string(),
  applicationStatus: z.enum(["hired"]),
  unitAvatarUrl: z.string().nullable(),
  internshipDuration: z.string().nullable(),
  internshipJobType: z.enum(["part_time", "full_time", "both"]).nullable(),
  applicationId: z.string(),
  hasTask: z.boolean(),
});

// 10. Interview Scheduled Candidates Response
export const interviewScheduledCandidateSchema = z.object({
  candidateId: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  profileSummary: z.string().nullable(),
  internshipDuration: z.string().nullable(),
  internshipJobType: z.enum(["part_time", "full_time", "both"]).nullable(),
  unitId: z.string(),
  unitAvatarUrl: z.string().nullable(),
  applicationId: z.string(),
  interviewDate: z.date(),
});

// 11. Shortlisted Candidates Response
export const shortlistedCandidateSchema = z.object({
  candidateId: z.string(),
  avatarUrl: z.string().nullable(),
  name: z.string().nullable(),
  internshipName: z.string(),
  applicationStatus: z.enum(["shortlisted"]),
  skills: z.array(z.string()).nullable(),
  interests: z.array(z.string()).nullable(),
});

// 12. Unit Registration Stats Response
export const unitRegistrationStatsSchema = z.object({
  totalRegisteredUnits: z.number(),
  activeUnits: z.number(),
  activeJobPosts: z.number(),
  totalApplications: z.number(),
});

// Pagination Metadata
export const paginationMetadataSchema = z.object({
  currentPage: z.number(),
  totalPages: z.number(),
  totalItems: z.number(),
  itemsPerPage: z.number(),
});

// Paginated Response Wrapper
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    pagination: paginationMetadataSchema,
  });

// Full candidate details (existing)
export const candidateFullResponseSchema = z.object({
  userId: z.string(),
  email: z.email().nullable(),
  name: z.string().nullable(),
  type: z.enum(["student", "fresher", "working", "graduate"]).nullable(),
  experienceLevel: z.string().nullable(),
  profileSummary: z.string().nullable(),
  location: z.string().nullable(),
  maritalStatus: z.enum(["married", "single", "prefer not to say"]).nullable(),
  isDifferentlyAbled: z.boolean().nullable(),
  hasCareerBreak: z.boolean().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  skills: z.array(z.string()).nullable(),
  interests: z.array(z.string()).nullable(),
  lookingFor: z.array(z.string()).nullable(),
  avatarUrl: z.string().nullable(),
  phone: z.string().nullable(),
  gender: z.enum(["male", "female", "other", "prefer not to say"]).nullable(),
  dateOfBirth: z.date().nullable(),
  onboardingCompleted: z.boolean(),
  education: z.array(z.any()).nullable(),
  language: z.array(z.string()).nullable(),
  course: z.array(z.any()).nullable(),
  internship: z.array(z.any()).nullable(),
  projects: z.array(z.any()).nullable(),
  socialLinks: z.record(z.string(), z.string()).nullable(),
});
