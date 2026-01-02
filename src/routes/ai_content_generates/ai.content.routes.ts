import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { BAD_REQUEST, OK } from "@/lib/openapi/http-status-codes";
import {
  createResponse,
  restrictedErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  generateInternshipContentRequestSchema,
  generateInternshipContentResponseSchema,
} from "./ai.content.schema";

import {
  enhanceProfileDescriptionRequestSchema,
  enhanceProfileDescriptionResponseSchema,
} from "./ai.content.schema";

/**
 * POST /ai/generate-content - Generate AI content for internship posting
 */
export const generateInternshipContent = createRoute({
  method: "post" as const,
  path: "/unit/ai/generate-content",
  tags: ["AI Content Generation"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Generate internship content using AI",
  description:
    "Generate compelling content for internship postings including about section, key responsibilities, benefits, and required skills based on the internship title",
  request: {
    body: {
      content: {
        "application/json": {
          schema: generateInternshipContentRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, generateInternshipContentResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
  },
});

/**
 * POST /ai/enhance-profile - Enhance candidate profile description
 */
export const enhanceProfileDescription = createRoute({
  method: "post" as const,
  path: "/candidate/ai/enhance-profile",
  tags: ["AI Profile Enhancement"],
  middleware: requireRole({ allowedRoles: ["candidate"] }),
  summary: "Enhance candidate profile description using AI",
  description:
    "Takes a candidate's profile description and enhances it with professional language, better structure, and improved clarity while maintaining the original meaning and personality",
  request: {
    body: {
      content: {
        "application/json": {
          schema: enhanceProfileDescriptionRequestSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, enhanceProfileDescriptionResponseSchema),
    [BAD_REQUEST]: createResponse(BAD_REQUEST, undefined, {
      includeErrors: true,
    }),
    ...restrictedErrorResponses,
  },
});

export type EnhanceProfileDescription = typeof enhanceProfileDescription;

export type GenerateInternshipContent = typeof generateInternshipContent;
