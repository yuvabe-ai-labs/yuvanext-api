import { desc, eq } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { courses } from "@/db/schema/course.schema";
import { units } from "@/db/schema/unit.schema";
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  OK,
} from "@/lib/openapi/http-status-codes";

import type { GetAllCourses } from "./course.routes";

// GET /courses - Get all courses
export const getAllCourses: AppRouteHandler<GetAllCourses> = async (c) => {
  const user = c.get("user");

  // Check if user is a candidate
  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates can view courses",
      },
      FORBIDDEN,
    );
  }

  try {
    // Get all courses with unit/creator information
    const coursesList = await db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        duration: courses.duration,
        category: courses.category,
        difficultyLevel: courses.difficultyLevel,
        createdBy: courses.createdBy,
        bannerUrl: courses.bannerUrl,
        redirectUrl: courses.redirectUrl,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        // Unit/Creator info
        creatorName: units.name,
        creatorAvatarUrl: units.avatarUrl,
        creatorType: units.type,
      })
      .from(courses)
      .leftJoin(units, eq(courses.createdBy, units.userId))
      .orderBy(desc(courses.createdAt));

    return c.json(
      {
        status_code: OK,
        message: "Courses retrieved successfully",
        data: coursesList,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching courses:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
