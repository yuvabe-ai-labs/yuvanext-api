import { z } from "zod";

import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Get human-readable description for HTTP status codes
 */
export function getDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    [OK]: "Success",
    [BAD_REQUEST]: "Invalid request data",
    [UNAUTHORIZED]: "Unauthorized - Authentication required",
    [FORBIDDEN]: "Forbidden - Insufficient permissions",
    [NOT_FOUND]: "Resource not found",
    [UNPROCESSABLE_ENTITY]: "Validation error",
    [INTERNAL_SERVER_ERROR]: "Internal server error",
  };
  return descriptions[statusCode] || "Response";
}

/**
 * Create a standardized OpenAPI response object
 * @param statusCode - HTTP status code
 * @param dataSchema - Optional Zod schema for the data field
 * @param options - Additional options for the response
 */

export function createResponse(
  statusCode: number,
  dataSchema?: z.ZodTypeAny,
  options?: {
    includeErrors?: boolean; // For BAD_REQUEST responses
    includeError?: boolean; // For UNPROCESSABLE_ENTITY responses
  },
) {
  const baseSchema: Record<string, any> = {
    status_code: z.literal(statusCode),
    message: z.string(),
  };

  // Add data field if schema provided
  if (dataSchema) {
    baseSchema.data = dataSchema;
  }

  // Add error field for UNPROCESSABLE_ENTITY
  if (statusCode === UNPROCESSABLE_ENTITY || options?.includeError) {
    baseSchema.error = z.any();
  }

  // Add errors array for BAD_REQUEST
  if (statusCode === BAD_REQUEST || options?.includeErrors) {
    baseSchema.errors = z.array(z.any()).optional();
  }

  return {
    description: getDescription(statusCode),
    content: {
      "application/json": {
        schema: z.object(baseSchema),
      },
    },
  };
}

// ============================================================================
// COMMON ERROR RESPONSE SETS
// ============================================================================

/**
 * Standard error responses for authenticated endpoints
 */
export const commonErrorResponses = {
  [UNAUTHORIZED]: createResponse(UNAUTHORIZED),
  [INTERNAL_SERVER_ERROR]: createResponse(INTERNAL_SERVER_ERROR),
};

/**
 * Error responses including forbidden access
 */
export const restrictedErrorResponses = {
  ...commonErrorResponses,
  [FORBIDDEN]: createResponse(FORBIDDEN),
};

/**
 * Error responses for CRUD operations (includes NOT_FOUND)
 */
export const crudErrorResponses = {
  ...commonErrorResponses,
  [NOT_FOUND]: createResponse(NOT_FOUND),
};

/**
 * Error responses for validation-heavy endpoints
 */
export const validationErrorResponses = {
  ...commonErrorResponses,
  [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
};

/**
 * Complete error response set for resource operations with validation
 * Includes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY, INTERNAL_SERVER_ERROR
 */
export const resourceErrorResponses = {
  ...commonErrorResponses,
  [FORBIDDEN]: createResponse(FORBIDDEN),
  [NOT_FOUND]: createResponse(NOT_FOUND),
  [UNPROCESSABLE_ENTITY]: createResponse(UNPROCESSABLE_ENTITY),
};
