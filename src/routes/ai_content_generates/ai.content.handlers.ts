import { z } from "zod";

import type { AppRouteHandler } from "@/types/app.types";

import {
  BAD_REQUEST,
  INTERNAL_SERVER_ERROR,
  OK,
} from "@/lib/openapi/http-status-codes";
import { generateInternshipContent } from "./ai.content.service";

import type { GenerateInternshipContent } from "./ai.content.routes";

import { enhanceProfileDescription } from "./ai.content.service";

import type { EnhanceProfileDescription } from "./ai.content.routes";

/**
 * POST /ai/generate-content - Generate AI content for internship posting
 */
export const generateContent: AppRouteHandler<
  GenerateInternshipContent
> = async (c) => {
  try {
    const { title, sections } = c.req.valid("json");

    // Generate content using AI
    const generatedContent = await generateInternshipContent(title, sections);

    if (!generatedContent) {
      return c.json(
        {
          status_code: INTERNAL_SERVER_ERROR,
          message: "Failed to generate content. Please try again.",
        },
        INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Content generated successfully",
        data: generatedContent,
      },
      OK,
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Invalid request data",
          errors: err.issues,
        },
        BAD_REQUEST,
      );
    }

    console.error("Error generating AI content:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * POST /ai/enhance-profile - Enhance candidate profile description using AI
 */
export const enhanceProfile: AppRouteHandler<
  EnhanceProfileDescription
> = async (c) => {
  try {
    const { description } = c.req.valid("json");

    // Enhance description using AI
    const enhancedDescription = await enhanceProfileDescription(description);

    if (!enhancedDescription) {
      return c.json(
        {
          status_code: INTERNAL_SERVER_ERROR,
          message: "Failed to enhance profile description. Please try again.",
        },
        INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Profile description enhanced successfully",
        data: {
          original: description,
          enhanced: enhancedDescription,
        },
      },
      OK,
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Invalid request data",
          errors: err.issues,
        },
        BAD_REQUEST,
      );
    }

    console.error("Error enhancing profile description:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
