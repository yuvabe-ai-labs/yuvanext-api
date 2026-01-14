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
  newUnitsThisMonth: z.string(),
  totalCandidates: z.number(),
  newCandidatesThisMonth: z.string(),
  totalActiveInternships: z.number(),
  newInternshipsThisMonth: z.string(),
  totalCourses: z.number(),
  newCoursesThisMonth: z.string(),
  totalHiredCandidates: z.number(),
  newHiresThisMonth: z.string(),
  healthPercentage: z.number().default(97),
});

// 2. Recent Candidates Response
export const recentCandidateSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  type: z.enum(["student", "fresher", "working", "graduate"]).nullable(),
  location: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
});

// 3. Recent Units Response
export const recentUnitSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

// 5. Active Units with Stats Response
export const activeUnitWithStatsSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  totalApplications: z.number(),
  totalActiveInternships: z.number(),
  avatarUrl: z.string().nullable(),
  internshipCreatedAt: z.date().nullable(),
  accountStatus: z.boolean(),
});

// 6. Recent Applied Candidates Response
export const recentAppliedCandidateSchema = z.object({
  applicationId: z.string(),
  candidateId: z.string(),
  candidateName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  skills: z.array(z.string()).nullable(),
  interests: z.array(z.string()).nullable(),
  profileSummary: z.string().nullable(),
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
  unitName: z.string().nullable(),
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
  profileSummary: z.string().nullable(),
});

// 12. Unit Registration Stats Response
export const unitRegistrationStatsSchema = z.object({
  totalRegisteredUnits: z.number(),
  activeUnits: z.number(),
  activeJobPosts: z.number(),
  totalApplications: z.number(),
});

// =====================================================
// ADD COMPANY REQUEST SCHEMA
// =====================================================

export const addCompanyRequestSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email("Valid email is required"),
  contactNumber: z.string().min(6, "Valid contact number is required"),
  companyType: z.enum(["auroville_unit", "non_auroville_unit"]),
  industryType: z.string().min(1, "Industry type is required"),
  address: z.string().min(1, "Address is required"),
  aboutCompany: z.string().min(1, "About the company is required"),
  serviceOffered: z.string().min(1, "Service offered is required"),
  achievements: z.string().optional(),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export const addCompanyResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  message: z.string(),
});

// =====================================================
// DEACTIVATE UNIT REQUEST SCHEMA
// =====================================================

export const deactivateUnitParamSchema = z.object({
  id: z.uuid(),
});

export const deactivateUnitResponseSchema = z.object({
  userId: z.string().uuid(),
  accountDisabled: z.boolean(),
  message: z.string(),
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
  applicationId: z.string().nullable(),
  applicationStatus: z
    .enum(["applied", "shortlisted", "not_shortlisted", "interviewed", "hired"])
    .nullable(),
  applicationCreatedAt: z.date().nullable(),
  applicationUpdatedAt: z.date().nullable(),
  internshipId: z.string().nullable(),
  internshipName: z.string().nullable(),
  internshipStatus: z.enum(["active", "closed", "draft"]).nullable(),
});

// get candidate and unit full response schema for admin only id name and created at
export const candidateAndUnitForAdminSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.date(),
});

export const internshipForAdminSchema = z.object({
  internshipId: z.string(),
  name: z.string(),
  createdById: z.string(),
  createdByName: z.string().nullable(),
  totalApplications: z.number(),
  duration: z.string().nullable(),
  createdAt: z.date(),
  status: z.string(),
});

// =====================================================
// INTERNSHIP ADMIN ENDPOINTS SCHEMAS
// =====================================================

// Query schema for getting all internships
export const getAllInternshipsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
});

// Response schema for disable/enable internship
export const disableInternshipResponseSchema = z.object({
  internshipId: z.string(),
  status: z.string(),
  message: z.string(),
});

export const enableInternshipResponseSchema = z.object({
  internshipId: z.string(),
  status: z.string(),
  message: z.string(),
});
