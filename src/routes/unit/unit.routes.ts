import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  INTERNAL_SERVER_ERROR,
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
  unitIdParamSchema,
  unitResponseSchema,
  unitWithInternshipsResponseSchema,
} from "./unit.schema";

/**
 * GET /units - List all units
 */
export const getAllUnits = createRoute({
  method: "get" as const,
  path: "/units",
  tags: ["Units"],
  middleware: requireRole({ allowedRoles: ["candidate", "admin"] }),
  summary: "Get all units",
  description:
    "Retrieve a list of all organization units/companies (candidate and admin only)",
  responses: {
    [OK]: createResponse(OK, z.array(unitResponseSchema)),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /units/:id - Get unit details by ID
 */
export const getUnitById = createRoute({
  method: "get" as const,
  path: "/units/{id}",
  tags: ["Units"],
  middleware: requireRole({ allowedRoles: ["candidate", "admin", "mentor"] }),
  summary: "Get unit details by ID",
  description:
    "Retrieve detailed information about a specific organization unit including their internships (candidate and admin only)",
  request: {
    params: unitIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, unitWithInternshipsResponseSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

/**
 * GET /public/units/:id - Unit profile for the public job board (no auth)
 */
export const getPublicUnitById = createRoute({
  method: "get" as const,
  path: "/public/units/{id}",
  tags: ["Units"],
  summary: "Get unit details publicly",
  description:
    "Unit profile and active internships for the public job board; no session required. Account email is not included.",
  request: {
    params: unitIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, unitWithInternshipsResponseSchema),
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
    [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
  },
});

export type GetAllUnits = typeof getAllUnits;
export type GetUnitById = typeof getUnitById;
export type GetPublicUnitById = typeof getPublicUnitById;
