import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";
import {
  createTaskSchema,
  enrichedtaskResponseSchema,
  getTasksQuerySchema,
  reviewTaskSchema,
  taskIdParamSchema,
  taskResponseSchema,
  updateTaskSchema,
} from "@/routes/task_management/task.schema";

// ============================================================================
// CUSTOM ERROR RESPONSES FOR TASKS
// ============================================================================

// Task routes need FORBIDDEN + NOT_FOUND + UNPROCESSABLE_ENTITY
const taskErrorResponses = {
  ...restrictedErrorResponses,
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
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Create a new task",
  description: "Create a new task for a specific application (Candidate only)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createTaskSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, taskResponseSchema),
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
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  description:
    "Get all tasks for the authenticated candidate. Optionally filter by applicationId",
  request: {
    query: getTasksQuerySchema,
  },
  responses: {
    [OK]: createResponse(OK, z.array(enrichedtaskResponseSchema)),
    ...restrictedErrorResponses,
  },
});

/**
 * PUT /tasks/:id - Update a task
 */
export const updateTask = createRoute({
  method: "put" as const,
  path: "/tasks/{id}",
  tags: ["Tasks - Candidate"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Update a task",
  description: "Update task details (Candidate only)",
  request: {
    params: taskIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateTaskSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, taskResponseSchema),
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
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Delete a task",
  description: "Delete a task by ID (Candidate only)",
  request: {
    params: taskIdParamSchema,
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
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Review a task",
  description:
    "Review a submitted task - mark as 'redo' or 'accepted' with remarks (Unit only)",
  request: {
    params: taskIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: reviewTaskSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, taskResponseSchema),
    ...taskErrorResponses,
  },
});

export type CreateTask = typeof createTask;
export type GetAllTasks = typeof getAllTasks;
export type UpdateTask = typeof updateTask;
export type DeleteTask = typeof deleteTask;
export type ReviewTask = typeof reviewTask;
