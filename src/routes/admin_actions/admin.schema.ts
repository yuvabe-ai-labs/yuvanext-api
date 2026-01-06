import { z } from "zod";

// Request Schemas
export const candidateIdParamSchema = z.object({
  id: z.uuid(),
});

export const candidateTypeEnum = z.enum([
  "student",
  "fresher",
  "working",
  "graduate",
]);

// Basic candidate list response (id, email, profile summary, avatar)
export const candidateListResponseSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  candidateType: candidateTypeEnum.nullable(),
  avatarUrl: z.string().nullable(),
});

// Full candidate response with all details
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
