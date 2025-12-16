import { z } from "zod";

// Enums
export const ApplicationStatusEnum = z.enum([
  "applied",
  "shortlisted",
  "rejected",
  "interviewed",
  "hired",
]);

// Request Schemas
export const SaveInternshipSchema = z.object({
  internshipId: z.uuid(),
});

export const RemoveSavedInternshipSchema = z.object({
  internshipId: z.uuid(),
});

export const ApplyToInternshipSchema = z.object({
  internshipId: z.uuid(),
  includedSections: z.array(z.string()).optional(),
});

export const InternshipIdParamSchema = z.object({
  id: z.uuid(),
});

// Response Schemas
export const SavedInternshipResponseSchema = z.object({
  id: z.uuid(),
  candidateId: z.uuid(),
  internshipId: z.uuid(),
  createdAt: z.union([z.string(), z.date()]),
});

export const ApplicationResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  internshipId: z.uuid(),
  status: ApplicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  profileScore: z.number().nullable(),
  candidateOfferDecision: z.enum(["accept", "reject", "pending"]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const SavedInternshipListItemSchema = z.object({
  id: z.uuid(),
  internshipId: z.uuid(),
  createdAt: z.union([z.string(), z.date()]),
  internshipTitle: z.string().nullable(),
  internshipDescription: z.string().nullable(),
  internshipCreatedBy: z.uuid().nullable(),
});

export const AppliedInternshipListItemSchema = z.object({
  id: z.uuid(),
  internshipId: z.uuid(),
  status: ApplicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  internshipTitle: z.string().nullable(),
  internshipDescription: z.string().nullable(),
  internshipCreatedBy: z.uuid().nullable(),
});

export const CountsResponseSchema = z.object({
  savedCount: z.number(),
  appliedCount: z.number(),
});

export const ShareLinksResponseSchema = z.object({
  facebook: z.url(),
  linkedin: z.url(),
  x: z.url(),
  whatsapp: z.url(),
  url: z.url(),
});

export const ApplicationStatusItemSchema = z.object({
  id: z.uuid(),
  applicationTitle: z.string().nullable(),
  status: ApplicationStatusEnum,
  unitName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});
