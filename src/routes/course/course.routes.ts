import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { OK } from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import { courseResponseSchema } from "./course.schema";

/**
 * GET /courses - List all courses
 */
export const getAllCourses = createRoute({
  method: "get" as const,
  path: "/courses",
  tags: ["Courses"],
  middleware: requireRole({ allowedRoles: ["candidate", "admin", "mentor"] }),
  summary: "Get all courses",
  description:
    "Retrieve a list of all available courses with creator information (candidates only)",
  responses: {
    [OK]: createResponse(OK, z.array(courseResponseSchema)),
    ...restrictedErrorResponses,
  },
});

export type GetAllCourses = typeof getAllCourses;
