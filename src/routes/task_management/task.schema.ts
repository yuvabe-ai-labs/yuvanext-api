import { z } from "zod";

// Enums
export const taskStatusEnum = z.enum([
  "pending",
  "submitted",
  "redo",
  "accepted",
]);

// Request Schemas
export const createTaskSchema = z.object({
  applicationId: z.uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
  status: taskStatusEnum.optional(),
  submissionLink: z.string().url().optional(),
});

export const reviewTaskSchema = z.object({
  status: z.enum(["redo", "accepted"]),
  reviewRemarks: z.string().min(1),
});

export const taskIdParamSchema = z.object({
  id: z.uuid(),
});

export const getTasksQuerySchema = z.object({
  applicationId: z.uuid().optional(),
});

// Response Schemas
export const taskResponseSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: taskStatusEnum,
  submittedAt: z.union([z.string(), z.date()]).nullable(),
  reviewedBy: z.uuid().nullable(),
  reviewRemarks: z.string().nullable(),
  reviewedAt: z.union([z.string(), z.date()]).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  color: z.string().nullable(),
  submissionLink: z.string().nullable(),
});

export const enrichedtaskResponseSchema = taskResponseSchema.extend({
  applicantName: z.string().nullable(),
  applicantPhone: z.string().nullable(),
  applicantEmail: z.string().nullable(),
  internshipTitle: z.string().nullable(),
  unitName: z.string().nullable(),
  unitId: z.string().nullable(),
  progress: z.number(),
});
