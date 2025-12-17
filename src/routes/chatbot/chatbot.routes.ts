import { createRoute } from "@hono/zod-openapi";

import {
  OK,
  REQUEST_TIMEOUT,
  TOO_MANY_REQUESTS,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";
import {
  commonErrorResponses,
  createResponse,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import {
  chatErrorResponseSchema,
  chatRequestSchema,
  chatSuccessResponseSchema,
} from "./chatbot.schema";

// ============================================================================
// RESPONSE EXAMPLES
// ============================================================================

const successExamples = {
  ongoing: {
    summary: "Ongoing conversation",
    value: {
      success: true,
      response:
        "Great! I've noted that you're interested in web development and AI. What skills do you currently have?",
    },
  },
  completed: {
    summary: "Onboarding completed",
    value: {
      success: true,
      response:
        "Perfect! You're all set. Your profile is complete and I'll help you find the best matches for you.",
      onboardingCompleted: true,
    },
  },
  alreadyCompleted: {
    summary: "Already completed onboarding",
    value: {
      success: true,
      response:
        "You have already completed the onboarding process! Your profile is all set up.",
      onboardingCompleted: true,
      skipQuestions: true,
    },
  },
};

const errorExamples = {
  validationError: {
    summary: "Field validation failed",
    value: {
      success: false,
      error:
        "Please provide a valid phone number with 10 digits. Could you please provide that information again?",
      needsRetry: true,
      fieldsFailed: ["phone"],
      errorType: "VALIDATION",
    },
  },
  invalidRequest: {
    summary: "Invalid request format",
    value: {
      success: false,
      error: "Message cannot be empty",
    },
  },
};

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * POST /chatbot - Interactive onboarding chatbot
 */
export const chat = createRoute({
  method: "post" as const,
  path: "/chatbot",
  tags: ["Chatbot"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Chat with onboarding bot",
  description: `
Interactive AI-powered chatbot for onboarding new users.

**Features:**
- Conversational profile completion
- Auto-detects and saves profile fields from natural language
- Intelligent data validation with retry logic
- Supports both candidates and units (organizations)
- Tracks onboarding progress

**For Candidates:**
Collects: phone, gender, skills, interests, candidate type, looking_for preferences, experience level

**For Units:**
Collects: name, type, phone, location, focus areas, skills offered, opportunities offered, Aurovillian status

**Usage:**
1. Send messages naturally (e.g., "I'm a student interested in web development")
2. The bot will guide you through required fields
3. Answer questions conversationally
4. Onboarding completes automatically when all fields are filled
  `.trim(),
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: chatRequestSchema,
          examples: {
            greeting: {
              summary: "Start conversation",
              value: { message: "Hi, I want to get started" },
            },
            withInfo: {
              summary: "Provide information",
              value: {
                message: "I'm a student interested in web development and AI",
              },
            },
            answerQuestion: {
              summary: "Answer bot's question",
              value: {
                message: "My skills are JavaScript, Python, and React",
              },
            },
          },
        },
      },
    },
  },
  responses: {
    [OK]: {
      description: "Successful chat response",
      content: {
        "application/json": {
          schema: chatSuccessResponseSchema,
          examples: successExamples,
        },
      },
    },
    [UNPROCESSABLE_ENTITY]: {
      description: "Validation error or invalid input",
      content: {
        "application/json": {
          schema: chatErrorResponseSchema,
          examples: errorExamples,
        },
      },
    },
    [REQUEST_TIMEOUT]: createResponse(REQUEST_TIMEOUT, chatErrorResponseSchema),
    [TOO_MANY_REQUESTS]: createResponse(
      TOO_MANY_REQUESTS,
      chatErrorResponseSchema,
    ),
    ...commonErrorResponses,
  },
});

export type Chat = typeof chat;
