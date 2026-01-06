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
  candidateIdParamSchema,
  candidateListResponseSchema,
  candidateFullResponseSchema,
} from "./admin.schema";

/**
 * GET /admin/candidates - List all candidates
 */
export const getAllCandidates = createRoute({
  method: "get" as const,
  path: "/admin/candidates",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get all candidates",
  description:
    "Retrieve a list of all candidates with basic information (admin only)",
  responses: {
    [OK]: createResponse(OK, z.array(candidateListResponseSchema)),
    ...restrictedErrorResponses,
  },
});

/**
 * GET /admin/candidates/:id - Get candidate details by ID
 */
export const getCandidateById = createRoute({
  method: "get" as const,
  path: "/admin/candidates/{id}",
  tags: ["Admin"],
  middleware: requireRole({ allowedRoles: ["admin"] }),
  summary: "Get candidate details by ID",
  description:
    "Retrieve full detailed information about a specific candidate (admin only)",
  request: {
    params: candidateIdParamSchema,
  },
  responses: {
    [OK]: createResponse(OK, candidateFullResponseSchema),
    ...restrictedErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
    [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
  },
});

export type GetAllCandidates = typeof getAllCandidates;
export type GetCandidateById = typeof getCandidateById;
