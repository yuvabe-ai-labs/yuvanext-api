import { z } from "zod";

// Enums
export const TaskStatusEnum = z.enum([
  "pending",
  "submitted",
  "redo",
  "accepted",
]);

// Request Schemas
export const CreateTaskSchema = z.object({
  applicationId: z.uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
  status: TaskStatusEnum.optional(),
  submissionLink: z.string().url().optional(),
});

export const ReviewTaskSchema = z.object({
  status: z.enum(["redo", "accepted"]),
  reviewRemarks: z.string().min(1),
});

export const TaskIdParamSchema = z.object({
  id: z.uuid(),
});

export const GetTasksQuerySchema = z.object({
  applicationId: z.uuid().optional(),
});

// Response Schemas
export const TaskResponseSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: TaskStatusEnum,
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

export const EnrichedTaskResponseSchema = TaskResponseSchema.extend({
  applicantName: z.string().nullable(),
  applicantPhone: z.string().nullable(),
  applicantEmail: z.string().nullable(),
  internshipTitle: z.string().nullable(),
  unitName: z.string().nullable(),
  unitId: z.string().nullable(),
  progress: z.number(),
});
