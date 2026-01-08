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
import { candidates } from "@/db/schema/candidate.schema";

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
    /* ============================
       CANDIDATE ROLE
    ============================ */
    if (user.role === "candidate") {
      const rows = await db
        .select({
          taskId: tasks.id,
          taskStatus: tasks.status,

          applicationId: applications.id,
          applicantId: applications.userId,
          applicantName: userTable.name,

          internshipId: internships.id,
          internshipName: internships.title,
          internshipCreatedAt: sql<string>`${internships.createdAt}::text`,
          internshipClosingDate: internships.closingDate,
          internshipDuration: internships.duration,
          internshipJobType: internships.jobType,

          unitName: units.name,
          unitAvatarUrl: units.avatarUrl,
        })
        .from(applications)
        .leftJoin(tasks, eq(tasks.applicationId, applications.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(userTable, eq(applications.userId, userTable.id))
        .leftJoin(units, eq(internships.createdBy, units.userId))
        .where(
          and(
            eq(applications.userId, user.id),
            eq(applications.status, "hired"),
          ),
        );

      const groupedData = rows.reduce<
        Array<{
          internshipId: string;
          internshipName: string | null;
          internshipCreatedAt: string | null;
          internshipClosingDate: string | null;
          internshipDuration: string | null;
          internshipJobType: string | null;
          applicationId: string;
          applicantId: string;
          applicantName: string | null;
          unitName: string | null;
          unitAvatarUrl: string | null;
          tasks: Array<{
            taskId: string;
            taskStatus: "pending" | "submitted" | "redo" | "accepted";
          }>;
        }>
      >((acc, row) => {
        let existing = acc.find((i) => i.internshipId === row.internshipId);

        if (!existing) {
          existing = {
            internshipId: row.internshipId,
            internshipName: row.internshipName,
            internshipCreatedAt: row.internshipCreatedAt,
            internshipClosingDate: row.internshipClosingDate,
            internshipDuration: row.internshipDuration,
            internshipJobType: row.internshipJobType,
            applicationId: row.applicationId,
            applicantId: row.applicantId,
            applicantName: row.applicantName,
            unitName: row.unitName,
            unitAvatarUrl: row.unitAvatarUrl,
            tasks: [],
          };
          acc.push(existing);
        }

        if (row.taskId) {
          existing.tasks.push({
            taskId: row.taskId,
            taskStatus: row.taskStatus!,
          });
        }

        return acc;
      }, []);

      return c.json(
        {
          status_code: OK,
          message: "Tasks retrieved successfully",
          data: groupedData,
        },
        OK,
      );
    }

    /* ============================
       UNIT ROLE
    ============================ */
    if (user.role === "unit") {
      const rows = await db
        .select({
          taskId: tasks.id,
          taskStatus: tasks.status,

          applicationId: applications.id,
          applicantId: applications.userId,
          applicantName: userTable.name,
          candidateAvatarUrl: candidates.avatarUrl,

          internshipId: internships.id,
          internshipName: internships.title,
          internshipCreatedAt: sql<string>`${internships.createdAt}::text`,
          internshipClosingDate: internships.closingDate,
          internshipDuration: internships.duration,
          internshipJobType: internships.jobType,

          unitName: units.name,
        })
        .from(applications)
        .leftJoin(tasks, eq(tasks.applicationId, applications.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(userTable, eq(applications.userId, userTable.id))
        .leftJoin(candidates, eq(applications.userId, candidates.userId))
        .leftJoin(units, eq(internships.createdBy, units.userId))
        .where(
          and(
            eq(internships.createdBy, user.id),
            eq(applications.status, "hired"),
          ),
        );

      const groupedData = rows.reduce<
        Array<{
          internshipId: string;
          internshipName: string | null;
          internshipCreatedAt: string | null;
          internshipClosingDate: string | null;
          internshipDuration: string | null;
          internshipJobType: string | null;
          applicationId: string;
          applicantId: string;
          applicantName: string | null;
          unitName: string | null;
          candidateAvatarUrl: string | null;
          tasks: Array<{
            taskId: string;
            taskStatus: "pending" | "submitted" | "redo" | "accepted";
          }>;
        }>
      >((acc, row) => {
        const key = `${row.internshipId}-${row.applicantId}`;
        let existing = acc.find(
          (i) => `${i.internshipId}-${i.applicantId}` === key,
        );

        if (!existing) {
          existing = {
            internshipId: row.internshipId,
            internshipName: row.internshipName,
            internshipCreatedAt: row.internshipCreatedAt,
            internshipClosingDate: row.internshipClosingDate,
            internshipDuration: row.internshipDuration,
            internshipJobType: row.internshipJobType,
            applicationId: row.applicationId,
            applicantId: row.applicantId,
            applicantName: row.applicantName,
            unitName: row.unitName,
            candidateAvatarUrl: row.candidateAvatarUrl,
            tasks: [],
          };
          acc.push(existing);
        }

        if (row.taskId) {
          existing.tasks.push({
            taskId: row.taskId,
            taskStatus: row.taskStatus!,
          });
        }

        return acc;
      }, []);

      return c.json(
        {
          status_code: OK,
          message: "Tasks retrieved successfully",
          data: groupedData,
        },
        OK,
      );
    }

    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Access denied",
      },
      FORBIDDEN,
    );
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
    let whereConditions;

    if (user.role === "candidate") {
      whereConditions = and(
        eq(applications.id, applicationId),
        eq(applications.userId, user.id),
        eq(applications.status, "hired"),
      );
    } else if (user.role === "unit") {
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

    const applicationTasks = await db
      .select({
        // ---- Task fields (nullable) ----
        taskId: tasks.id,
        taskStatus: tasks.status,
        taskTitle: tasks.title,
        taskDescription: tasks.description,
        taskCreatedAt: sql<string | null>`${tasks.createdAt}::text`,
        taskEndDate: tasks.endDate,
        taskStartDate: tasks.startDate,
        taskStartTime: tasks.startTime,
        taskEndTime: tasks.endTime,
        taskColor: tasks.color,
        taskSubmissionLink: tasks.submissionLink,
        taskSubmittedAt: sql<string | null>`${tasks.submittedAt}::text`,
        taskReviewRemarks: tasks.reviewRemarks,
        taskReviewedAt: sql<string | null>`${tasks.reviewedAt}::text`,

        // ---- Application / applicant ----
        applicationId: applications.id,
        applicantId: applications.userId,
        applicantName: userTable.name,
        applicantEmail: userTable.email,
        candidateAvatarUrl: candidates.avatarUrl,
        candidatePhoneNumber: candidates.phone,

        // ---- Internship ----
        internshipId: internships.id,
        internshipName: internships.title,
        internshipCreatedAt: sql<string>`${internships.createdAt}::text`,
        internshipClosingDate: internships.closingDate,
      })
      .from(applications)
      .leftJoin(tasks, eq(tasks.applicationId, applications.id)) // ✅ LEFT JOIN
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(userTable, eq(applications.userId, userTable.id))
      .innerJoin(candidates, eq(applications.userId, candidates.userId))
      .where(whereConditions);

    // ❌ Do NOT return NOT_FOUND when no task
    if (applicationTasks.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Application not found",
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
