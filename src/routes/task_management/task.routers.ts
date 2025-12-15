import { z } from "zod";

import { createRouter } from "@/lib/create-app";
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./task.handlers";

const router = createRouter();

// ============================================================================
// SCHEMAS
// ============================================================================

const TaskSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: z.enum(["pending", "submitted", "redo", "accepted"]),
  submittedAt: z.string().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewRemarks: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  color: z.string().nullable(),
  submissionLink: z.string().nullable(),
});

const CreateTaskSchema = z.object({
  applicationId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(["pending", "submitted", "redo", "accepted"]).optional(),
  submissionLink: z.string().url().optional(),
});

const _SubmitTaskSchema = z.object({
  submissionLink: z.string().url(),
});

const ReviewTaskSchema = z.object({
  status: z.enum(["redo", "accepted"]),
  reviewRemarks: z.string().min(1),
});

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function createResponse(statusCode: number, dataSchema?: z.ZodTypeAny) {
  return {
    description: getDescription(statusCode),
    content: {
      "application/json": {
        schema: z.object({
          status_code: z.literal(statusCode),
          message: z.string(),
          ...(dataSchema && { data: dataSchema }),
          ...(statusCode === UNPROCESSABLE_ENTITY && { error: z.any() }),
        }),
      },
    },
  };
}

function getDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    [OK]: "Success",
    [BAD_REQUEST]: "Bad request",
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [FORBIDDEN]: "Forbidden - Insufficient permissions",
    [NOT_FOUND]: "Resource not found",
    [UNPROCESSABLE_ENTITY]: "Validation error",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

const commonErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [FORBIDDEN]: createResponse(FORBIDDEN),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

const taskErrorResponses = {
  ...commonErrorResponses,
  [NOT_FOUND]: createResponse(NOT_FOUND),
  [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

router.use(requireAuth);

// ============================================================================
// CANDIDATE ROUTES
// ============================================================================

/**
 * POST /tasks - Create a new task
 */
router.openapi(
  {
    method: "post",
    path: "/tasks",
    tags: ["Tasks - Candidate"],
    summary: "Create a new task",
    description:
      "Create a new task for a specific application (Candidate only)",
    security: [{ Bearer: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateTaskSchema,
          },
        },
      },
    },
    responses: {
      [OK]: createResponse(OK, TaskSchema),
      ...taskErrorResponses,
    },
  },
  handlers.createTask,
);

/**
GET /tasks - Get all tasks with internship details and progress (Both Candidate and Unit)
 */
router.openapi(
  {
    method: "get",
    path: "/tasks",
    tags: ["Tasks - Candidate"],
    summary: "Get all tasks",
    description:
      "Get all tasks for the authenticated candidate. Optionally filter by applicationId",
    security: [{ Bearer: [] }],
    request: {
      query: z.object({
        applicationId: z.string().uuid().optional(),
      }),
    },
    responses: {
      [OK]: createResponse(OK, z.array(TaskSchema)),
      ...commonErrorResponses,
    },
  },
  handlers.getAllTasks,
);

/**
 * PUT /tasks/:id - Update a task
 */

router.openapi(
  {
    method: "put",
    path: "/tasks/{id}",
    tags: ["Tasks - Candidate"],
    summary: "Update a task",
    description: "Update task details (Candidate only)",
    security: [{ Bearer: [] }],
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateTaskSchema,
          },
        },
      },
    },
    responses: {
      [OK]: createResponse(OK, TaskSchema),
      ...taskErrorResponses,
    },
  },
  handlers.updateTask,
);

/**
 * DELETE /tasks/:id - Delete a task
 */
router.openapi(
  {
    method: "delete",
    path: "/tasks/{id}",
    tags: ["Tasks - Candidate"],
    summary: "Delete a task",
    description: "Delete a task by ID (Candidate only)",
    security: [{ Bearer: [] }],
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    responses: {
      [OK]: createResponse(OK),
      ...taskErrorResponses,
    },
  },
  handlers.deleteTask,
);

// ============================================================================
// UNIT ROUTES
// ============================================================================

/**
 * POST /tasks/:id/review - Review a task (Unit)
 */
router.openapi(
  {
    method: "post",
    path: "/tasks/{id}/review",
    tags: ["Tasks - Unit"],
    summary: "Review a task",
    description:
      "Review a submitted task - mark as 'redo' or 'accepted' with remarks (Unit only)",
    security: [{ Bearer: [] }],
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: {
        content: {
          "application/json": {
            schema: ReviewTaskSchema,
          },
        },
      },
    },
    responses: {
      [OK]: createResponse(OK, TaskSchema),
      ...taskErrorResponses,
    },
  },
  handlers.reviewTask,
);

export default router;
