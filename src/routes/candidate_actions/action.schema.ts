import { z } from "zod";

// Enums - match your database schema exactly
export const applicationStatusEnum = z.enum([
  "applied",
  "shortlisted",
  "rejected",
  "interviewed",
  "hired",
  "not_shortlisted",
]);

export const offerDecisionEnum = z.enum(["accept", "reject", "pending"]);
export const unitOfferDecisionEnum = z.enum(["selected", "reject", "pending"]);

// Sort Query Schema (removed pagination)
export const sortQuerySchema = z.object({
  sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Request Schemas
export const saveInternshipSchema = z.object({
  internshipId: z.string().uuid(),
});

export const applyToInternshipIdSchema = z.object({
  internshipId: z.string().uuid(),
});

export const removeSavedInternshipSchema = z.object({
  internshipId: z.string().uuid(),
});

export const applyToInternshipSchema = z
  .object({
    includedSections: z.array(z.string()).optional(),
  })
  .openapi({
    example: {
      includedSections: ["education", "experience", "skills"],
    },
  });

export const internshipIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const acceptOfferParamSchema = z.object({
  applicationId: z.string().uuid(),
});

export const acceptOrRejectOfferSchema = z
  .object({
    decision: z.enum(["accept", "reject"]),
  })
  .openapi({
    example: {
      decision: "accept",
    },
  });

// Unit/Creator Information Schema (reusable)
export const unitInfoSchema = z.object({
  userId: z.string().uuid().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  description: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  location: z.string().nullable(),
});

// Response Schemas
export const savedinternshipResponseSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
  internshipId: z.string().uuid(),
  createdAt: z.union([z.string(), z.date()]),
});

export const applicationResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  internshipId: z.string().uuid(),
  status: applicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  profileScore: z.number().nullable(),
  candidateOfferDecision: offerDecisionEnum,
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const savedInternshipListItemSchema = z.object({
  id: z.string().uuid(),
  internshipId: z.string().uuid(),
  createdAt: z.union([z.string(), z.date()]),
  internshipTitle: z.string().nullable(),
  internshipDescription: z.string().nullable(),
  createdBy: unitInfoSchema,
});

export const appliedInternshipListItemSchema = z.object({
  id: z.string().uuid(),
  internshipId: z.string().uuid(),
  status: applicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  internshipTitle: z.string().nullable(),
  internshipDescription: z.string().nullable(),
  createdBy: unitInfoSchema,
});

export const countsResponseSchema = z.object({
  savedCount: z.number().int().nonnegative(),
  appliedCount: z.number().int().nonnegative(),
});

export const shareLinksResponseSchema = z.object({
  facebook: z.string(),
  linkedin: z.string(),
  x: z.string(),
  whatsapp: z.string(),
  url: z.string(),
});

export const applicationStatusItemSchema = z.object({
  id: z.string().uuid(),
  applicationTitle: z.string().nullable(),
  status: applicationStatusEnum,
  candidateOfferDecision: offerDecisionEnum,
  unitOfferDecision: unitOfferDecisionEnum,
  unitName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const acceptOfferResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  internshipId: z.string().uuid(),
  status: applicationStatusEnum,
  includedSections: z.array(z.string()).nullable(),
  profileScore: z.number().nullable(),
  candidateOfferDecision: offerDecisionEnum,
  unitOfferDecision: unitOfferDecisionEnum,
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});
export const savedInternshipsListSchema = z.array(
  savedInternshipListItemSchema,
);
export const appliedInternshipsListSchema = z.array(
  appliedInternshipListItemSchema,
);

// Error Response Schema
export const errorResponseSchema = z.object({
  status_code: z.number().int(),
  message: z.string(),
  code: z.string().optional(),
  errors: z.array(z.string()).optional(),
  resource: z.record(z.string(), z.any()).optional(),
});

// Type exports
export type ApplicationStatus = z.infer<typeof applicationStatusEnum>;
export type OfferDecision = z.infer<typeof offerDecisionEnum>;
export type UnitOfferDecision = z.infer<typeof unitOfferDecisionEnum>;
export type SortQuery = z.infer<typeof sortQuerySchema>;
export type SavedInternshipListItem = z.infer<
  typeof savedInternshipListItemSchema
>;
export type AppliedInternshipListItem = z.infer<
  typeof appliedInternshipListItemSchema
>;
export type ApplicationStatusItem = z.infer<typeof applicationStatusItemSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
