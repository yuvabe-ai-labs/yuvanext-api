import { eq } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { internships } from "@/db/schema/internship.schema";
import { tasks } from "@/db/schema/task.management.schema";
import { units } from "@/db/schema/unit.schema";
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";

import type {
  CreateTask,
  DeleteTask,
  GetAllTasks,
  ReviewTask,
  UpdateTask,
} from "./task.routers";

import {
  CreateTaskSchema,
  ReviewTaskSchema,
  UpdateTaskSchema,
} from "./task.schema";

// ============================================================================
// CANDIDATE HANDLERS
// ============================================================================

// POST /tasks - Create a new task (Candidate)
export const createTask: AppRouteHandler<CreateTask> = async (c) => {
  const user = c.get("user");

  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates can create tasks",
      },
      FORBIDDEN,
    );
  }

  try {
    const json = await c.req.json().catch(() => ({}));
    const parsed = CreateTaskSchema.safeParse(json);

    if (!parsed.success) {
      return c.json(
        {
          status_code: UNPROCESSABLE_ENTITY,
          message: "Validation Error",
          error: parsed.error.issues,
        },
        UNPROCESSABLE_ENTITY,
      );
    }

    const data = parsed.data;

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

// GET /tasks - Get all tasks with internship details and progress (Both Candidate and Unit)
export const getAllTasks: AppRouteHandler<GetAllTasks> = async (c) => {
  const user = c.get("user");

  try {
    const applicationId = c.req.query("applicationId");

    let relevantApplications: (typeof applications.$inferSelect)[];

    if (user.role === "candidate") {
      // Get all applications for this candidate
      relevantApplications = await db
        .select()
        .from(applications)
        .where(eq(applications.userId, user.id));
    } else if (user.role === "unit") {
      // Get all applications for internships owned by this unit
      const unitInternships = await db
        .select()
        .from(internships)
        .where(eq(internships.createdBy, user.id));

      const internshipIds = unitInternships.map((int) => int.id);

      if (internshipIds.length === 0) {
        return c.json(
          {
            status_code: OK,
            message: "Tasks retrieved successfully",
            data: [],
          },
          OK,
        );
      }

      // Get all applications for these internships
      relevantApplications = [];
      for (const intId of internshipIds) {
        const apps = await db
          .select()
          .from(applications)
          .where(eq(applications.internshipId, intId));
        relevantApplications.push(...apps);
      }
    } else {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "Access denied",
        },
        FORBIDDEN,
      );
    }

    if (relevantApplications.length === 0) {
      return c.json(
        {
          status_code: OK,
          message: "Tasks retrieved successfully",
          data: [],
        },
        OK,
      );
    }

    const applicationIds = relevantApplications.map((app) => app.id);

    // Filter by applicationId if provided
    let targetApplicationIds = applicationIds;
    if (applicationId) {
      if (!applicationIds.includes(applicationId)) {
        return c.json(
          {
            status_code: FORBIDDEN,
            message: "You can only view tasks for your own applications",
          },
          FORBIDDEN,
        );
      }
      targetApplicationIds = [applicationId];
    }

    // Get all tasks for the target applications
    const allTasks: (typeof tasks.$inferSelect)[] = [];
    for (const appId of targetApplicationIds) {
      const appTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.applicationId, appId));
      allTasks.push(...appTasks);
    }

    // Enrich tasks with application, internship, and unit details
    const enrichedTasks = await Promise.all(
      allTasks.map(async (task) => {
        // Get application details
        const application = await db
          .select()
          .from(applications)
          .where(eq(applications.id, task.applicationId))
          .limit(1);

        if (!application.length) {
          return {
            ...task,
            applicantName: null,
            applicantPhone: null,
            applicantEmail: null,
            internshipTitle: null,
            unitName: null,
            unitId: null,
            progress: 0,
          };
        }

        // Get applicant (user) details using candidate table
        let applicantName: string | null = null;
        let applicantPhone: string | null = null;
        let applicantEmail: string | null = null;
        const candidate = await db
          .select()
          .from(candidates)
          .where(eq(candidates.userId, application[0].userId))
          .limit(1);

        if (candidate.length) {
          const candidateUser = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, candidate[0].userId))
            .limit(1);
          if (candidateUser.length) {
            applicantName = candidateUser[0].name;
            applicantEmail = candidateUser[0].email;
          }
          applicantPhone = candidate[0].phone;
        }

        // Get internship details
        const internship = await db
          .select()
          .from(internships)
          .where(eq(internships.id, application[0].internshipId!))
          .limit(1);

        // Get unit details
        let unitName: string | null = null;
        let unitId: string | null = null;
        if (internship.length && internship[0].createdBy) {
          const unitRecord = await db
            .select()
            .from(units)
            .where(eq(units.userId, internship[0].createdBy))
            .limit(1);
          unitName = unitRecord.length ? unitRecord[0].name : null;
          unitId = internship[0].createdBy;
        }

        // Calculate progress for this application
        const applicationTasks = await db
          .select()
          .from(tasks)
          .where(eq(tasks.applicationId, task.applicationId));

        const totalTasks = applicationTasks.length;
        const completedTasks = applicationTasks.filter(
          (t) => t.status === "accepted",
        ).length;
        const progress =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          ...task,
          applicantName,
          applicantPhone,
          applicantEmail,
          internshipTitle: internship.length ? internship[0].title : null,
          unitName,
          unitId,
          progress,
        };
      }),
    );

    return c.json(
      {
        status_code: OK,
        message: "Tasks retrieved successfully",
        data: enrichedTasks,
      },
      OK,
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

// PUT /tasks/:id - Update a task (Candidate)
export const updateTask: AppRouteHandler<UpdateTask> = async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("id");

  if (!taskId) {
    return c.json(
      {
        status_code: UNPROCESSABLE_ENTITY,
        message: "Task ID is required",
      },
      UNPROCESSABLE_ENTITY,
    );
  }

  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates can update tasks",
      },
      FORBIDDEN,
    );
  }

  try {
    const json = await c.req.json().catch(() => ({}));
    const parsed = UpdateTaskSchema.safeParse(json);

    if (!parsed.success) {
      return c.json(
        {
          status_code: UNPROCESSABLE_ENTITY,
          message: "Validation Error",
          error: parsed.error.issues,
        },
        UNPROCESSABLE_ENTITY,
      );
    }

    // Check if task exists and belongs to candidate
    const task = await db
      .select()
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

    const application = await db
      .select()
      .from(applications)
      .where(eq(applications.id, task[0].applicationId))
      .limit(1);

    if (!application.length || application[0].userId !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only update your own tasks",
        },
        FORBIDDEN,
      );
    }

    // Update the task
    const data = parsed.data;
    const updatedTask = await db
      .update(tasks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Task updated successfully",
        data: updatedTask[0],
      },
      OK,
    );
  } catch (err) {
    console.error("Error updating task:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /tasks/:id - Delete a task (Candidate)
export const deleteTask: AppRouteHandler<DeleteTask> = async (c) => {
  const user = c.get("user");
  const taskId = c.req.param("id");

  if (!taskId) {
    return c.json(
      {
        status_code: UNPROCESSABLE_ENTITY,
        message: "Task ID is required",
      },
      UNPROCESSABLE_ENTITY,
    );
  }

  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates can delete tasks",
      },
      FORBIDDEN,
    );
  }

  try {
    // Check if task exists and belongs to candidate
    const task = await db
      .select()
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

    const application = await db
      .select()
      .from(applications)
      .where(eq(applications.id, task[0].applicationId))
      .limit(1);

    if (!application.length || application[0].userId !== user.id) {
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
  const taskId = c.req.param("id");

  if (!taskId) {
    return c.json(
      {
        status_code: UNPROCESSABLE_ENTITY,
        message: "Task ID is required",
      },
      UNPROCESSABLE_ENTITY,
    );
  }

  if (user.role !== "unit") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only units can review tasks",
      },
      FORBIDDEN,
    );
  }

  try {
    const json = await c.req.json().catch(() => ({}));
    const parsed = ReviewTaskSchema.safeParse(json);

    if (!parsed.success) {
      return c.json(
        {
          status_code: UNPROCESSABLE_ENTITY,
          message: "Validation Error",
          error: parsed.error.issues,
        },
        UNPROCESSABLE_ENTITY,
      );
    }

    // Check if task exists
    const task = await db
      .select()
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

    // Verify the task belongs to an application for this unit's internship
    const application = await db
      .select()
      .from(applications)
      .where(eq(applications.id, task[0].applicationId))
      .limit(1);

    if (!application.length) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Associated application not found",
        },
        NOT_FOUND,
      );
    }

    // Review the task
    const data = parsed.data;
    const updatedTask = await db
      .update(tasks)
      .set({
        status: data.status,
        reviewRemarks: data.reviewRemarks,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: `Task ${data.status === "accepted" ? "accepted" : "marked for redo"} successfully`,
        data: updatedTask[0],
      },
      OK,
    );
  } catch (err) {
    console.error("Error reviewing task:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
