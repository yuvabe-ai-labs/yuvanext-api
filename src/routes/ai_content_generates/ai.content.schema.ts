import { z } from "zod";

// Section types that can be generated
export const contentSectionEnum = z.enum([
  "about",
  "key_responsibilities",
  "what_you_will_get",
  "skills_required",
]);

// Request Schema
export const generateInternshipContentRequestSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(200)
    .describe("The internship title (e.g., 'Frontend Developer Intern')"),
  sections: z
    .array(contentSectionEnum)
    .min(1)
    .max(4)
    .describe(
      "Array of sections to generate. Options: about, key_responsibilities, what_you_will_get, skills_required",
    ),
});

// Response Schema
export const generateInternshipContentResponseSchema = z.object({
  about: z
    .string()
    .optional()
    .describe("Generated about/description section for the internship"),
  key_responsibilities: z
    .array(z.string())
    .optional()
    .describe("List of key responsibilities and duties"),
  what_you_will_get: z
    .array(z.string())
    .optional()
    .describe("List of benefits and learning opportunities"),
  skills_required: z
    .array(z.string())
    .optional()
    .describe("List of required and preferred skills"),
});

// Request Schema
export const enhanceProfileDescriptionRequestSchema = z.object({
  description: z
    .string()
    .min(10)
    .max(5000)
    .describe("The original profile description to enhance"),
});

// Response Schema
export const enhanceProfileDescriptionResponseSchema = z.object({
  original: z.string().describe("The original profile description"),
  enhanced: z.string().describe("The AI-enhanced profile description"),
});

export type EnhanceProfileRequest = z.infer<
  typeof enhanceProfileDescriptionRequestSchema
>;
export type EnhancedProfileResponse = z.infer<
  typeof enhanceProfileDescriptionResponseSchema
>;
// Type exports for use in handlers
export type ContentSection = z.infer<typeof contentSectionEnum>;
export type GenerateContentRequest = z.infer<
  typeof generateInternshipContentRequestSchema
>;
export type GeneratedContent = z.infer<
  typeof generateInternshipContentResponseSchema
>;
