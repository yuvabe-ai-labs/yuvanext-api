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

export const applicationIdParamSchema = z.object({
  applicationId: z.uuid(),
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

// Unified response for both candidate and unit GET /tasks (grouped by internship)
export const groupedTasksResponseSchema = z.object({
  internshipId: z.string(),
  internshipName: z.string().nullable(),
  internshipStartDate: z.string().nullable(),
  internshipEndDate: z.string().nullable(),
  applicationId: z.string(),
  applicantId: z.string(),
  applicantName: z.string().nullable(),
  unitName: z.string().nullable(),
  tasks: z.array(
    z.object({
      taskId: z.string(),
      taskStatus: taskStatusEnum,
    }),
  ),
});

// Response for unit's GET /tasks/application/:applicationId
export const applicationTasksResponseSchema = z.object({
  taskId: z.string(),
  taskStatus: taskStatusEnum,
  taskTitle: z.string(),
  taskDescription: z.string().nullable(),
  taskStartDate: z.string().nullable(),
  taskEndDate: z.string().nullable(),
  taskStartTime: z.string().nullable(),
  taskEndTime: z.string().nullable(),
  taskSubmissionLink: z.string().nullable(),
  taskSubmittedAt: z.union([z.string(), z.date()]).nullable(),
  taskReviewRemarks: z.string().nullable(),
  taskReviewedAt: z.union([z.string(), z.date()]).nullable(),
  applicationId: z.string(),
  applicantId: z.string(),
  applicantName: z.string().nullable(),
  applicantEmail: z.string().nullable(),
  internshipName: z.string().nullable(),
  internshipStartDate: z.string().nullable(),
  internshipEndDate: z.string().nullable(),
});
