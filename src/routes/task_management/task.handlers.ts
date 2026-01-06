import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppRouteHandler } from "@/types/app.types";
import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { user as userTable } from "@/db/schema/auth.schema";
import { internships } from "@/db/schema/internship.schema";
import { tasks } from "@/db/schema/task.management.schema";
import { units } from "@/db/schema/unit.schema";
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type {
  CreateTask,
  DeleteTask,
  GetAllTasks,
  GetTasksByApplicationId,
  ReviewTask,
  UpdateTask,
} from "./task.routers";

// ============================================================================
// CANDIDATE HANDLERS
// ============================================================================

// POST /tasks - Create a new task (Candidate)
export const createTask: AppRouteHandler<CreateTask> = async (c) => {
  const user = c.get("user");

  try {
    const data = c.req.valid("json");

    // Verify the application belongs to the candidate
    const application = await db
      .select()
      .from(applications)
      .where(eq(applications.id, data.applicationId))
      .limit(1);

    if (!application.length) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Application not found",
        },
        NOT_FOUND,
      );
    }

    if (application[0].userId !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only create tasks for your own applications",
        },
        FORBIDDEN,
      );
    }

    // Create the task
    const newTask = await db
      .insert(tasks)
      .values({
        applicationId: data.applicationId,
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color || "#3B82F6",
        status: "pending",
      })
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Task created successfully",
        data: newTask[0],
      },
      OK,
    );
  } catch (err) {
    console.error("Error creating task:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /tasks - Get all tasks for hired candidates (grouped by internship)
export const getAllTasks: AppRouteHandler<GetAllTasks> = async (c) => {
  const user = c.get("user");

  try {
    if (user.role === "candidate") {
      // Get all HIRED applications for this candidate with tasks
      const candidateTasks = await db
        .select({
          taskId: tasks.id,
          taskStatus: tasks.status,
          applicationId: applications.id,
          applicantId: applications.userId,
          applicantName: userTable.name,
          internshipId: internships.id,
          internshipName: internships.title,
          internshipcreatedAt: sql<string>`${internships.createdAt}::text`,
          internshipclosingDate: internships.closingDate,
          unitName: units.name,
        })
        .from(applications)
        .innerJoin(tasks, eq(tasks.applicationId, applications.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(userTable, eq(applications.userId, userTable.id))
        .leftJoin(units, eq(internships.createdBy, units.userId))
        .where(
          and(
            eq(applications.userId, user.id),
            eq(applications.status, "hired"),
          ),
        );

      // Group tasks by internship
      const groupedData = candidateTasks.reduce(
        (acc, task) => {
          const existingInternship = acc.find(
            (item) => item.internshipId === task.internshipId,
          );

          if (existingInternship) {
            existingInternship.tasks.push({
              taskId: task.taskId,
              taskStatus: task.taskStatus,
            });
          } else {
            acc.push({
              internshipId: task.internshipId,
              internshipName: task.internshipName,
              internshipcreatedAt: task.internshipcreatedAt,
              internshipclosingDate: task.internshipclosingDate,
              applicationId: task.applicationId,
              applicantId: task.applicantId,
              applicantName: task.applicantName,
              unitName: task.unitName,
              tasks: [
                {
                  taskId: task.taskId,
                  taskStatus: task.taskStatus,
                },
              ],
            });
          }

          return acc;
        },
        [] as Array<{
          internshipId: string;
          internshipName: string | null;
          internshipcreatedAt: string | null;
          internshipclosingDate: string | null;
          applicationId: string;
          applicantId: string;
          applicantName: string | null;
          unitName: string | null;
          tasks: Array<{
            taskId: string;
            taskStatus: "pending" | "submitted" | "redo" | "accepted";
          }>;
        }>,
      );

      return c.json(
        {
          status_code: OK,
          message: "Tasks retrieved successfully",
          data: groupedData,
        },
        OK,
      );
    } else if (user.role === "unit") {
      // Get all tasks for HIRED candidates in this unit's internships
      const unitTasks = await db
        .select({
          taskId: tasks.id,
          taskStatus: tasks.status,
          applicationId: applications.id,
          applicantId: applications.userId,
          applicantName: userTable.name,
          internshipId: internships.id,
          internshipName: internships.title,
          internshipcreatedAt: sql<string>`${internships.createdAt}::text`,
          internshipclosingDate: internships.closingDate,
          unitName: units.name,
        })
        .from(applications)
        .innerJoin(tasks, eq(tasks.applicationId, applications.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(userTable, eq(applications.userId, userTable.id))
        .leftJoin(units, eq(internships.createdBy, units.userId))
        .where(
          and(
            eq(internships.createdBy, user.id),
            eq(applications.status, "hired"),
          ),
        );

      // Group tasks by internship and applicant
      const groupedData = unitTasks.reduce(
        (acc, task) => {
          const key = `${task.internshipId}-${task.applicantId}`;
          const existingGroup = acc.find(
            (item) => `${item.internshipId}-${item.applicantId}` === key,
          );

          if (existingGroup) {
            existingGroup.tasks.push({
              taskId: task.taskId,
              taskStatus: task.taskStatus,
            });
          } else {
            acc.push({
              internshipId: task.internshipId,
              internshipName: task.internshipName,
              internshipcreatedAt: task.internshipcreatedAt,
              internshipclosingDate: task.internshipclosingDate,
              applicationId: task.applicationId,
              applicantId: task.applicantId,
              applicantName: task.applicantName,
              unitName: task.unitName,
              tasks: [
                {
                  taskId: task.taskId,
                  taskStatus: task.taskStatus,
                },
              ],
            });
          }

          return acc;
        },
        [] as Array<{
          internshipId: string;
          internshipName: string | null;
          internshipcreatedAt: string | null;
          internshipclosingDate: string | null;
          applicationId: string;
          applicantId: string;
          applicantName: string | null;
          unitName: string | null;
          tasks: Array<{
            taskId: string;
            taskStatus: "pending" | "submitted" | "redo" | "accepted";
          }>;
        }>,
      );

      return c.json(
        {
          status_code: OK,
          message: "Tasks retrieved successfully",
          data: groupedData,
        },
        OK,
      );
    } else {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "Access denied",
        },
        FORBIDDEN,
      );
    }
  } catch (err) {
    console.error("Error fetching tasks:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /tasks/application/:applicationId - Get all tasks by application ID
export const getTasksByApplicationId: AppRouteHandler<
  GetTasksByApplicationId
> = async (c) => {
  const user = c.get("user");
  const { applicationId } = c.req.valid("param");

  try {
    // Build where conditions based on user role
    let whereConditions;

    if (user.role === "candidate") {
      // Candidate can only access their own applications
      whereConditions = and(
        eq(applications.id, applicationId),
        eq(applications.userId, user.id),
        eq(applications.status, "hired"),
      );
    } else if (user.role === "unit") {
      // Unit can access applications for their internships
      whereConditions = and(
        eq(applications.id, applicationId),
        eq(internships.createdBy, user.id),
        eq(applications.status, "hired"),
      );
    } else {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "Access denied",
        },
        FORBIDDEN,
      );
    }

    // Fetch the application tasks with all details
    const applicationTasks = await db
      .select({
        taskId: tasks.id,
        taskStatus: tasks.status,
        taskTitle: tasks.title,
        taskDescription: tasks.description,
        taskCreatedAt: sql<string>`${tasks.createdAt}::text`,
        taskEndDate: tasks.endDate,
        taskStartDate: tasks.startDate,
        taskStartTime: tasks.startTime,
        taskEndTime: tasks.endTime,
        taskColor: tasks.color,
        taskSubmissionLink: tasks.submissionLink,
        taskSubmittedAt: sql<string | null>`${tasks.submittedAt}::text`,
        taskReviewRemarks: tasks.reviewRemarks,
        taskReviewedAt: sql<string | null>`${tasks.reviewedAt}::text`,
        applicationId: applications.id,
        applicantId: applications.userId,
        applicantName: userTable.name,
        applicantEmail: userTable.email,
        internshipId: internships.id,
        internshipName: internships.title,
        internshipCreatedAt: sql<string>`${internships.createdAt}::text`,
        internshipClosingDate: internships.closingDate,
      })
      .from(applications)
      .innerJoin(tasks, eq(tasks.applicationId, applications.id))
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(userTable, eq(applications.userId, userTable.id))
      .where(whereConditions);

    if (applicationTasks.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "No tasks found for this application",
        },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Tasks retrieved successfully",
        data: applicationTasks,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching tasks by application ID:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// PUT /tasks/:id - Update a task (Candidate)
export const updateTask: AppRouteHandler<UpdateTask> = async (c) => {
  const user = c.get("user");
  const { id: taskId } = c.req.valid("param");
  const body = c.req.valid("json");

  try {
    // First verify task exists and get its applicationId
    const task = await db
      .select({ applicationId: tasks.applicationId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Task not found",
        },
        NOT_FOUND,
      );
    }

    // Verify the application belongs to the user
    const application = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.id, task[0].applicationId),
          eq(applications.userId, user.id),
        ),
      )
      .limit(1);

    if (!application.length) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only update tasks for your own applications",
        },
        FORBIDDEN,
      );
    }

    // Update the task
    const [updatedTask] = await db
      .update(tasks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Task updated successfully",
        data: updatedTask,
      },
      OK,
    );
  } catch (err) {
    console.error("Error updating task:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /tasks/:id - Delete a task (Candidate)
export const deleteTask: AppRouteHandler<DeleteTask> = async (c) => {
  const user = c.get("user");
  const { id: taskId } = c.req.valid("param");

  try {
    // Get task with application in ONE query
    const taskData = await db
      .select({
        taskId: tasks.id,
        applicationUserId: applications.userId,
      })
      .from(tasks)
      .innerJoin(applications, eq(tasks.applicationId, applications.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!taskData.length) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Task not found",
        },
        NOT_FOUND,
      );
    }

    if (taskData[0].applicationUserId !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only delete your own tasks",
        },
        FORBIDDEN,
      );
    }

    // Delete the task
    await db.delete(tasks).where(eq(tasks.id, taskId));

    return c.json(
      {
        status_code: OK,
        message: "Task deleted successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error deleting task:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// ============================================================================
// UNIT HANDLERS
// ============================================================================

// POST /tasks/:id/review - Review a task (Unit - mark as redo or accepted)
export const reviewTask: AppRouteHandler<ReviewTask> = async (c) => {
  const user = c.get("user");

  const { id: taskId } = c.req.valid("param");
  const body = c.req.valid("json");

  try {
    const [updatedTask] = await db
      .update(tasks)
      .set({
        status: body.status,
        reviewRemarks: body.reviewRemarks,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          inArray(
            tasks.applicationId,
            db
              .select({ id: applications.id })
              .from(applications)
              .innerJoin(
                internships,
                eq(applications.internshipId, internships.id),
              )
              .where(eq(internships.createdBy, user.id)),
          ),
        ),
      )
      .returning();

    if (!updatedTask) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Task not found or not assignable to your unit",
        },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: `Task ${body.status === "accepted" ? "accepted" : "marked for redo"} successfully`,
        data: updatedTask,
      },
      OK,
    );
  } catch (err) {
    console.error("Error reviewing task:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};
