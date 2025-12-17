import { z } from "zod";

// Enums
export const difficultyLevelEnum = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

// Response Schemas
export const courseResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  category: z.string().nullable(),
  difficultyLevel: difficultyLevelEnum.nullable(),
  createdBy: z.uuid(),
  bannerUrl: z.string().nullable(),
  redirectUrl: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  creatorName: z.string().nullable(),
  creatorAvatarUrl: z.string().nullable(),
  creatorType: z.string().nullable(),
});
