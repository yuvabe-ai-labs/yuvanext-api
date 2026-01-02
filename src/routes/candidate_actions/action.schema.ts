import { create } from "node:domain";
import { z } from "zod";

// Enums
export const applicationStatusEnum = z.enum([
  "applied",
  "shortlisted",
  "rejected",
  "interviewed",
  "hired",
]);

// Request Schemas
export const saveInternshipSchema = z.object({
  internshipId: z.uuid(),
});

export const applyToInternshipIdSchema = z.object({
  internshipId: z.uuid(),
});

export const removeSavedInternshipSchema = z.object({
  internshipId: z.uuid(),
});

export const applyToInternshipSchema = z.object({
  includedSections: z.array(z.string()).optional(),
});

export const internshipIdParamSchema = z.object({
  id: z.uuid(),
});

export const acceptOfferParamSchema = z.object({
  applicationId: z.uuid(),
});

export const acceptOrRejectOfferSchema = z.object({
  decision: z.enum(["accept", "reject"]),
});

// Response Schemas
export const savedinternshipResponseSchema = z.object({
  id: z.uuid(),
  candidateId: z.uuid(),
  internshipId: z.uuid(),
  createdAt: z.union([z.string(), z.date()]),
});

export const applicationResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  internshipId: z.uuid(),
  status: applicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  profileScore: z.number().nullable(),
  candidateOfferDecision: z.enum(["accept", "reject", "pending"]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const savedInternshipListItemSchema = z.object({
  id: z.uuid(),
  internshipId: z.uuid(),
  createdAt: z.union([z.string(), z.date()]),
  internshipTitle: z.string().nullable(),
  internshipDescription: z.string().nullable(),
  internshipCreatedBy: z.uuid().nullable(),
  createdByMetadata: {
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    description: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    location: z.string().nullable(),
  },
});

export const appliedInternshipListItemSchema = z.object({
  id: z.uuid(),
  internshipId: z.uuid(),
  status: applicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  internshipTitle: z.string().nullable(),
  internshipDescription: z.string().nullable(),
  internshipCreatedBy: z.uuid().nullable(),
  createdByMetadata: {
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    description: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    location: z.string().nullable(),
  },
});

export const countsResponseSchema = z.object({
  savedCount: z.number(),
  appliedCount: z.number(),
});

export const shareLinksResponseSchema = z.object({
  facebook: z.url(),
  linkedin: z.url(),
  x: z.url(),
  whatsapp: z.url(),
  url: z.url(),
});

export const applicationStatusItemSchema = z.object({
  id: z.uuid(),
  applicationTitle: z.string().nullable(),
  status: applicationStatusEnum,
  candidateOfferDecision: z.enum(["accept", "reject", "pending"]),
  unitOfferDecision: z.enum(["selected", "reject", "pending"]),
  unitName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const acceptOfferResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  internshipId: z.uuid(),
  status: applicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  profileScore: z.number().nullable(),
  candidateOfferDecision: z.enum(["accept", "reject", "pending"]),
  unitOfferDecision: z.enum(["selected", "reject", "pending"]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});
