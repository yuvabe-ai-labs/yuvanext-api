import { z } from "zod";

// Request Schemas
export const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .describe("User's message to the chatbot"),
});

// Response Schemas
export const chatSuccessResponseSchema = z.object({
  success: z.literal(true),
  response: z.string().describe("Chatbot's response message"),
  onboardingCompleted: z
    .boolean()
    .optional()
    .describe("Whether onboarding was completed with this message"),
  skipQuestions: z
    .boolean()
    .optional()
    .describe("Whether to skip further onboarding questions"),
});

export const chatErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string().describe("Error message"),
  needsRetry: z
    .boolean()
    .optional()
    .describe("Whether user should retry with corrected input"),
  fieldsFailed: z
    .array(z.string())
    .optional()
    .describe("Fields that failed validation"),
  errorType: z
    .enum(["TIMEOUT", "THROTTLING", "VALIDATION"])
    .optional()
    .describe("Type of error that occurred"),
});
