import { z } from "zod";

// unit.routes.ts
import { createRouter } from "@/lib/create-app";
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./unit.handlers";

const router = createRouter();

// ============================================================================
// SCHEMAS
// ============================================================================

const UnitIdParamSchema = z.object({
  id: z.uuid(),
});

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function createResponse(statusCode: number, dataSchema?: z.ZodTypeAny) {
  return {
    description: getDescription(statusCode),
    content: {
      "application/json": {
        schema: z.object({
          status_code: z.literal(statusCode),
          message: z.string(),
          ...(dataSchema && { data: dataSchema }),
        }),
      },
    },
  };
}

function getDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    [OK]: "Success",
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [FORBIDDEN]: "Forbidden - Candidates only",
    [NOT_FOUND]: "Unit not found",
    [UNPROCESSABLE_ENTITY]: "Invalid unit ID",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

const commonErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [FORBIDDEN]: createResponse(FORBIDDEN),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

const unitByIdErrorResponses = {
  ...commonErrorResponses,
  [NOT_FOUND]: createResponse(NOT_FOUND),
  [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /units - List all units
 */
router.openapi(
  {
    method: "get",
    path: "/units",
    tags: ["Units"],
    summary: "Get all units",
    description:
      "Retrieve a list of all organization units/companies (candidate only)",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: createResponse(OK, z.array(z.any())),
      ...commonErrorResponses,
    },
  },
  handlers.getAllUnits,
);

/**
 * GET /units/:id - Get unit details by ID
 */
router.openapi(
  {
    method: "get",
    path: "/units/{id}",
    tags: ["Units"],
    summary: "Get unit details by ID",
    description:
      "Retrieve detailed information about a specific organization unit (candidate only)",
    security: [{ Bearer: [] }],
    request: {
      params: UnitIdParamSchema,
    },
    responses: {
      [OK]: createResponse(OK, z.any()),
      ...unitByIdErrorResponses,
    },
  },
  handlers.getUnitById,
);

export default router;
