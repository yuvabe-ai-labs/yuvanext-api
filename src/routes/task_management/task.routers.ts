import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  CreateTaskSchema,
  EnrichedTaskResponseSchema,
  GetTasksQuerySchema,
  ReviewTaskSchema,
  TaskIdParamSchema,
  TaskResponseSchema,
  UpdateTaskSchema,
} from "@/routes/task_management/task.schema";

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
// ROUTE DEFINITIONS - CANDIDATE
// ============================================================================

/**
 * POST /tasks - Create a new task
 */
export const createTask = createRoute({
  method: "post" as const,
  path: "/tasks",
  tags: ["Tasks - Candidate"],
  summary: "Create a new task",
  description: "Create a new task for a specific application (Candidate only)",
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
    [OK]: createResponse(OK, TaskResponseSchema),
    ...taskErrorResponses,
  },
});

/**
 * GET /tasks - Get all tasks with internship details and progress
 */
export const getAllTasks = createRoute({
  method: "get" as const,
  path: "/tasks",
  tags: ["Tasks - Candidate"],
  summary: "Get all tasks",
  description:
    "Get all tasks for the authenticated candidate. Optionally filter by applicationId",
  security: [{ Bearer: [] }],
  request: {
    query: GetTasksQuerySchema,
  },
  responses: {
    [OK]: createResponse(OK, z.array(EnrichedTaskResponseSchema)),
    ...commonErrorResponses,
  },
});

/**
 * PUT /tasks/:id - Update a task
 */
export const updateTask = createRoute({
  method: "put" as const,
  path: "/tasks/{id}",
  tags: ["Tasks - Candidate"],
  summary: "Update a task",
  description: "Update task details (Candidate only)",
  security: [{ Bearer: [] }],
  request: {
    params: TaskIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateTaskSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, TaskResponseSchema),
    ...taskErrorResponses,
  },
});

/**
 * DELETE /tasks/:id - Delete a task
 */
export const deleteTask = createRoute({
  method: "delete" as const,
  path: "/tasks/{id}",
  tags: ["Tasks - Candidate"],
  summary: "Delete a task",
  description: "Delete a task by ID (Candidate only)",
  security: [{ Bearer: [] }],
  request: {
    params: TaskIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK),
    ...taskErrorResponses,
  },
});

// ============================================================================
// ROUTE DEFINITIONS - UNIT
// ============================================================================

/**
 * POST /tasks/:id/review - Review a task (Unit)
 */
export const reviewTask = createRoute({
  method: "post" as const,
  path: "/tasks/{id}/review",
  tags: ["Tasks - Unit"],
  summary: "Review a task",
  description:
    "Review a submitted task - mark as 'redo' or 'accepted' with remarks (Unit only)",
  security: [{ Bearer: [] }],
  request: {
    params: TaskIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: ReviewTaskSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, TaskResponseSchema),
    ...taskErrorResponses,
  },
});

export type CreateTask = typeof createTask;
export type GetAllTasks = typeof getAllTasks;
export type UpdateTask = typeof updateTask;
export type DeleteTask = typeof deleteTask;
export type ReviewTask = typeof reviewTask;
