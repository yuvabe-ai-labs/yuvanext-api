import { z } from "zod";

export const genderEnum = z.enum(["male", "female", "other"]);

export const maritalStatusEnum = z.enum([
  "married",
  "single",
  "prefer not to say",
]);

const socialLinkSchema = z.object({
  id: z.string().optional(),
  platform: z.string(),
  url: z.url(),
});

const languageSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    read: z.boolean(),
    speak: z.boolean(),
    write: z.boolean(),
  }),
]);

export const updateProfileSchema = z
  .object({
    // user fields
    name: z.string().min(1).optional(),
    image: z.url().optional(),

    // candidate/unit shared/simple fields
    profileSummary: z.string().min(1).max(2000).optional(),
    avatarUrl: z.url().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),

    // candidate-specific complex fields (allow loose types to keep flexibility)
    type: z.string().optional(),
    experienceLevel: z.string().optional(),
    maritalStatus: maritalStatusEnum.optional(),
    isDifferentlyAbled: z.boolean().optional(),
    hasCareerBreak: z.boolean().optional(),
    skills: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    lookingFor: z.array(z.string()).optional(),
    gender: genderEnum.optional(),
    dateOfBirth: z.string().optional(),
    onboardingCompleted: z.boolean().optional(),
    education: z.array(z.any()).optional(),
    language: z.array(languageSchema).optional(),
    course: z.array(z.any()).optional(),
    internship: z.array(z.any()).optional(),
    projects: z.array(z.any()).optional(),
    socialLinks: z.array(socialLinkSchema).optional(),
    // unit-specific fields
    // Accept plain strings for website (some clients submit non-URL values)
    websiteUrl: z.string().optional(),
    mission: z.string().optional(),
    values: z.string().optional(),
    description: z.string().optional(),
    industry: z.string().optional(),
    isAurovillian: z.boolean().optional(),
    bannerUrl: z.url().optional(),
    galleryImages: z.array(z.string()).optional(),
    galleryVideos: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
    skillsOffered: z.array(z.string()).optional(),
    opportunitiesOffered: z.array(z.any()).optional(),
  })
  .partial()
  .catchall(z.any());

// Base user fields that are always present
const baseUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  role: z.enum(["candidate", "unit", "admin"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Candidate-specific fields
const candidateFieldsSchema = z.object({
  userId: z.string(),
  type: z.string().nullable(),
  experienceLevel: z.string().nullable(),
  profileSummary: z.string().nullable(),
  location: z.string().nullable(),
  maritalStatus: maritalStatusEnum.nullable(),
  isDifferentlyAbled: z.boolean().nullable(),
  hasCareerBreak: z.boolean().nullable(),
  skills: z.array(z.string()).nullable(),
  interests: z.array(z.string()).nullable(),
  lookingFor: z.array(z.string()).nullable(),
  avatarUrl: z.string().nullable(),
  phone: z.string().nullable(),
  gender: genderEnum.nullable(),
  dateOfBirth: z.date().nullable(),
  onboardingCompleted: z.boolean().nullable(),
  education: z.array(z.any()).nullable(),
  language: z.array(languageSchema).nullable(),
  course: z.array(z.any()).nullable(),
  internship: z.array(z.any()).nullable(),
  projects: z.array(z.any()).nullable(),
  socialLinks: z.array(socialLinkSchema).nullable(),
});

// Unit-specific fields
const unitFieldsSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  type: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  location: z.string().nullable(),
  onboardingCompleted: z.boolean().nullable(),
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
  focusAreas: z.array(z.string()).nullable(),
  skillsOffered: z.array(z.string()).nullable(),
  opportunitiesOffered: z.array(z.any()).nullable(),
  projects: z.array(z.any()).nullable(),
  socialLinks: z.array(socialLinkSchema).nullable(),
});

// Mentor-specific fields
const mentorFieldsSchema = z.object({
  userId: z.string().optional(),
  mentorType: z.string().nullable(),
  expertiseAreas: z.array(z.string()).nullable(),
  experienceSnapshot: z.string().nullable(),
  availabilityDays: z.array(z.string()).nullable(),
  availabilityTimeWindows: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
      }),
    )
    .nullable(),
  timezone: z.string().nullable(),
  mentoringCapacity: z.string().nullable(),
  preferredStages: z.array(z.string()).nullable(),
  communicationModes: z.array(z.string()).nullable(),
  confirmBoundaries: z.boolean().nullable(),
  onboardingCompleted: z.boolean().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
});

// Profile score field (always included in GET /profile response)
const profileScoreSchema = z.object({
  profileScore: z.number().min(0).max(100),
});

// Profile response can be user + candidate fields or user + unit fields or user + mentor fields
// Always includes profileScore
export const profileResponseSchema = z.union([
  baseUserSchema.merge(mentorFieldsSchema.partial()).merge(profileScoreSchema),
]);

const _updateAvatarSchema = z.object({
  avatarUrl: z.url(),
});

export { _updateAvatarSchema };
