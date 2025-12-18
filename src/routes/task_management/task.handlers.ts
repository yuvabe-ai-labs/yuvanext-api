import { and, eq, inArray } from "drizzle-orm";

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
} from "@/lib/openapi/http-status-codes";

import type {
  CreateTask,
  DeleteTask,
  GetAllTasks,
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

// GET /tasks - Get all tasks with internship details and progress (Both Candidate and Unit)
export const getAllTasks: AppRouteHandler<GetAllTasks> = async (c) => {
  const user = c.get("user");

  try {
    const { applicationId } = c.req.valid("query");

    let relevantApplicationIds: string[];

    if (user.role === "candidate") {
      // Get all application IDs for this candidate
      const apps = await db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.userId, user.id));

      relevantApplicationIds = apps.map((app) => app.id);
    } else if (user.role === "unit") {
      // Get all internship IDs owned by this unit
      const unitInternships = await db
        .select({ id: internships.id })
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

      // Get all application IDs for these internships in ONE query
      const apps = await db
        .select({ id: applications.id })
        .from(applications)
        .where(inArray(applications.internshipId, internshipIds));

      relevantApplicationIds = apps.map((app) => app.id);
    } else {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "Access denied",
        },
        FORBIDDEN,
      );
    }

    if (relevantApplicationIds.length === 0) {
      return c.json(
        {
          status_code: OK,
          message: "Tasks retrieved successfully",
          data: [],
        },
        OK,
      );
    }

    // Filter by applicationId if provided
    if (applicationId) {
      if (!relevantApplicationIds.includes(applicationId)) {
        return c.json(
          {
            status_code: FORBIDDEN,
            message: "You can only view tasks for your own applications",
          },
          FORBIDDEN,
        );
      }
      relevantApplicationIds = [applicationId];
    }

    // Fetch ALL tasks for target applications in ONE query
    const allTasks = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.applicationId, relevantApplicationIds));

    if (allTasks.length === 0) {
      return c.json(
        {
          status_code: OK,
          message: "Tasks retrieved successfully",
          data: [],
        },
        OK,
      );
    }

    // Get all unique application IDs from tasks
    const taskApplicationIds = [
      ...new Set(allTasks.map((t) => t.applicationId)),
    ];

    // Fetch ALL related data in bulk queries
    // 1. Get all applications with internships and units in ONE query
    const applicationsData = await db
      .select({
        applicationId: applications.id,
        userId: applications.userId,
        internshipId: applications.internshipId,
        internshipTitle: internships.title,
        internshipCreatedBy: internships.createdBy,
        unitName: units.name,
      })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .leftJoin(units, eq(internships.createdBy, units.userId))
      .where(inArray(applications.id, taskApplicationIds));

    // 2. Get all unique user IDs
    const userIds = [...new Set(applicationsData.map((a) => a.userId))];

    // 3. Get all candidates for these users in ONE query
    const candidatesData = await db
      .select()
      .from(candidates)
      .where(inArray(candidates.userId, userIds));

    // 4. Get all user details in ONE query
    const usersData = await db
      .select()
      .from(userTable)
      .where(inArray(userTable.id, userIds));

    // 5. Calculate progress for each application (group tasks by applicationId)
    const tasksByApplication = allTasks.reduce(
      (acc, task) => {
        if (!acc[task.applicationId]) {
          acc[task.applicationId] = [];
        }
        acc[task.applicationId].push(task);
        return acc;
      },
      {} as Record<string, typeof allTasks>,
    );

    const progressByApplication: Record<string, number> = {};
    for (const [appId, appTasks] of Object.entries(tasksByApplication)) {
      const totalTasks = appTasks.length;
      const completedTasks = appTasks.filter(
        (t) => t.status === "accepted",
      ).length;
      progressByApplication[appId] =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    }

    // Create lookup maps for O(1) access
    const applicationMap = new Map(
      applicationsData.map((a) => [a.applicationId, a]),
    );
    const candidateMap = new Map(candidatesData.map((c) => [c.userId, c]));
    const userMap = new Map(usersData.map((u) => [u.id, u]));

    // Enrich tasks with all related data (no more DB queries!)
    const enrichedTasks = allTasks.map((task) => {
      const application = applicationMap.get(task.applicationId);

      if (!application) {
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

      const candidate = candidateMap.get(application.userId);
      const userInfo = userMap.get(application.userId);

      return {
        ...task,
        applicantName: userInfo?.name || null,
        applicantPhone: candidate?.phone || null,
        applicantEmail: userInfo?.email || null,
        internshipTitle: application.internshipTitle,
        unitName: application.unitName,
        unitId: application.internshipCreatedBy,
        progress: progressByApplication[task.applicationId] || 0,
      };
    });

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
