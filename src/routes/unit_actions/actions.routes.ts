import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { BAD_REQUEST, NOT_FOUND, OK } from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  applicationResponseSchema,
  updateApplicationStatusResponseSchema,
  updateApplicationStatusSchema,
} from "./actions.shema";

/**
 * GET /applications - Get all applications for unit's internships
 */
export const getApplications = createRoute({
  method: "get" as const,
  path: "/unit/applications",
  tags: ["Unit Actions"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Get all applications for unit's internships",
  description:
    "Returns all applications submitted to internships posted by the unit, including candidate profile details and internship information",
  responses: {
    [OK]: createResponse(OK, z.array(applicationResponseSchema)),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * PUT /applications/status - Update application status
 */
export const updateApplicationStatus = createRoute({
  method: "put" as const,
  path: "/unit/applications/status",
  tags: ["Unit Actions"],
  summary: "Update application status",
  middleware: requireRole({ allowedRoles: ["unit"] }),
  description:
    "Allows units to update the status of applications for their internships. Automatically sends notifications and emails to candidates based on the new status.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateApplicationStatusSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, updateApplicationStatusResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

export type GetApplications = typeof getApplications;
export type UpdateApplicationStatus = typeof updateApplicationStatus;
