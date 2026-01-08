// chatbot.handlers.ts - Type-safe streaming response

import { eq } from "drizzle-orm";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";

import db from "@/db";
import { candidates } from "@/db/schema/candidate.schema";
import { units } from "@/db/schema/unit.schema";

import {
  addToConversation,
  detectAndExtractFields,
  generateTextStreamFromModel,
  getConversation,
  getLastBotQuestion,
  validateAndExtractData,
} from "./chatbot.service";
import { CANDIDATE_SYSTEM_PROMPT, UNIT_SYSTEM_PROMPT } from "./prompts";

export const chat = async (c: Context) => {
  const body = await c.req.json();
  const { message } = body;

  const user = c.get("user");

  const userId = user.id as string;
  const convoKey = userId;
  const role = user.role;

  let SYSTEM_PROMPT = CANDIDATE_SYSTEM_PROMPT;
  if (role === "unit") {
    SYSTEM_PROMPT = UNIT_SYSTEM_PROMPT;
  }

  // OPTIMIZED: Combined helper function for both candidate and unit
  const ensureProfileExists = async (
    userId: string,
    role: "candidate" | "unit",
  ): Promise<{
    exists: boolean;
    onboardingCompleted: boolean;
  }> => {
    try {
      if (role === "candidate") {
        const existing = await db
          .select({
            onboardingCompleted: candidates.onboardingCompleted,
          })
          .from(candidates)
          .where(eq(candidates.userId, userId))
          .limit(1);

        if (existing.length > 0) {
          return {
            exists: true,
            onboardingCompleted: existing[0].onboardingCompleted || false,
          };
        }

        await db.insert(candidates).values({
          userId,
          onboardingCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          exists: true,
          onboardingCompleted: false,
        };
      } else {
        // role === "unit"
        const existing = await db
          .select({
            onboardingCompleted: units.onboardingCompleted,
          })
          .from(units)
          .where(eq(units.userId, userId))
          .limit(1);

        if (existing.length > 0) {
          return {
            exists: true,
            onboardingCompleted: existing[0].onboardingCompleted || false,
          };
        }

        await db.insert(units).values({
          userId,
          onboardingCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          exists: true,
          onboardingCompleted: false,
        };
      }
    } catch {
      return {
        exists: false,
        onboardingCompleted: false,
      };
    }
  };

  // OPTIMIZED: Combined onboarding completion function
  const markOnboardingComplete = async (
    userId: string,
    role: "candidate" | "unit",
  ): Promise<boolean> => {
    try {
      if (role === "candidate") {
        await db
          .update(candidates)
          .set({
            onboardingCompleted: true,
            updatedAt: new Date(),
          })
          .where(eq(candidates.userId, userId));
      } else {
        await db
          .update(units)
          .set({
            onboardingCompleted: true,
            updatedAt: new Date(),
          })
          .where(eq(units.userId, userId));
      }
      return true;
    } catch {
      return false;
    }
  };

  // OPTIMIZED: Generic field saving function that handles both candidates and units
  const saveField = async (
    field: string,
    value: any,
    lastQuestion: string,
    role: "candidate" | "unit",
  ): Promise<{
    success: boolean;
    error?: string;
    needsRetry?: boolean;
    retryPrompt?: string;
    extractedValue?: any;
  }> => {
    try {
      const validationResult = await validateAndExtractData(
        String(value || ""),
        lastQuestion,
        field,
        role,
      );

      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.validationMessage,
          needsRetry: true,
          retryPrompt: `${validationResult.validationMessage} Could you please provide that information again?`,
        };
      }

      const extractedValue = validationResult.extractedValue;

      // Helper to process array values
      const toArray = (val: any): string[] => {
        if (Array.isArray(val)) {
          return val
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (typeof val === "string") {
          return val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return [];
      };

      // Save to appropriate table based on role
      if (role === "candidate") {
        switch (field.toLowerCase()) {
          case "phone":
            await db
              .update(candidates)
              .set({ phone: String(extractedValue || "") })
              .where(eq(candidates.userId, userId));
            break;

          case "gender": {
            const genderValue = String(extractedValue || "").toLowerCase();
            await db
              .update(candidates)
              .set({ gender: genderValue as any })
              .where(eq(candidates.userId, userId));
            break;
          }

          case "experience_level":
            await db
              .update(candidates)
              .set({ experienceLevel: String(extractedValue || "") })
              .where(eq(candidates.userId, userId));
            break;

          case "skills":
            await db
              .update(candidates)
              .set({ skills: toArray(extractedValue) })
              .where(eq(candidates.userId, userId));
            break;

          case "interests":
            await db
              .update(candidates)
              .set({ interests: toArray(extractedValue) })
              .where(eq(candidates.userId, userId));
            break;

          case "type": {
            const typeValue = String(extractedValue || "").toLowerCase();
            await db
              .update(candidates)
              .set({ type: typeValue as any })
              .where(eq(candidates.userId, userId));
            break;
          }

          case "looking_for": {
            const arr = toArray(extractedValue).map((s) => s.toLowerCase());
            const result = await db
              .update(candidates)
              .set({ lookingFor: arr })
              .where(eq(candidates.userId, userId))
              .returning();

            if (result.length === 0) {
              throw new Error("No candidate record found to update");
            }
            break;
          }

          default:
            return { success: false, error: "Field not supported" };
        }
      } else {
        // role === "unit"
        switch (field.toLowerCase()) {
          case "name":
            await db
              .update(units)
              .set({ name: String(extractedValue || "") })
              .where(eq(units.userId, userId));
            break;

          case "type":
            await db
              .update(units)
              .set({ type: String(extractedValue || "") })
              .where(eq(units.userId, userId));
            break;

          case "phone":
            await db
              .update(units)
              .set({ phone: String(extractedValue || "") })
              .where(eq(units.userId, userId));
            break;

          case "location":
            await db
              .update(units)
              .set({ location: String(extractedValue || "") })
              .where(eq(units.userId, userId));
            break;

          case "focus_areas":
            await db
              .update(units)
              .set({ focusAreas: toArray(extractedValue) })
              .where(eq(units.userId, userId));
            break;

          case "skills_offered":
            await db
              .update(units)
              .set({ skillsOffered: toArray(extractedValue) })
              .where(eq(units.userId, userId));
            break;

          case "is_aurovillian": {
            const boolValue =
              String(extractedValue || "").toLowerCase() === "true" ||
              String(extractedValue || "").toLowerCase() === "yes" ||
              String(extractedValue || "").toLowerCase() === "aurovillian";

            await db
              .update(units)
              .set({ isAurovillian: boolValue })
              .where(eq(units.userId, userId));
            break;
          }

          case "opportunities_offered":
            await db
              .update(units)
              .set({ opportunitiesOffered: toArray(extractedValue) })
              .where(eq(units.userId, userId));
            break;

          default:
            return { success: false, error: "Field not supported" };
        }
      }

      return { success: true, extractedValue };
    } catch (err) {
      return {
        success: false,
        error: String(err instanceof Error ? err.message : "Database error"),
        needsRetry: true,
        retryPrompt:
          "Something went wrong. Could you please try answering that question again?",
      };
    }
  };

  try {
    // Validate role
    if (role !== "candidate" && role !== "unit") {
      return c.json(
        {
          success: false as const,
          error: "Invalid user role",
        },
        422,
      );
    }

    // Check if profile exists and onboarding status
    const onboardingStatus = await ensureProfileExists(userId, role);

    if (!onboardingStatus.exists) {
      return c.json(
        {
          success: false as const,
          error: `Failed to access ${role} profile`,
        },
        500,
      );
    }

    // If onboarding is already completed, return static JSON (not streaming)
    if (onboardingStatus.onboardingCompleted) {
      const completionMessage =
        role === "candidate"
          ? "You have already completed the onboarding process! Your profile is all set up. You can now explore internships, courses, and opportunities on the platform."
          : "You have already completed the unit registration! Your unit profile is all set up. You can now start posting opportunities and finding candidates.";

      return c.json(
        {
          success: true as const,
          response: completionMessage,
          onboardingCompleted: true,
          skipQuestions: true,
        },
        200,
      );
    }

    // Get conversation history
    const storedHistory = getConversation(convoKey);
    const lastBotQuestion = getLastBotQuestion(convoKey);

    // AUTO-DETECT fields from user message
    let fieldsToSave: Array<{ field: string; value: any }> = [];

    if (lastBotQuestion) {
      try {
        const detection = await detectAndExtractFields(
          message,
          lastBotQuestion,
          storedHistory,
          role,
        );

        // Filter high-confidence detections
        fieldsToSave = detection.fieldsDetected
          .filter((f) => f.confidence > 0.7)
          .map((f) => ({ field: f.field, value: f.value }));
      } catch {
        // Continue without auto-save if detection fails
      }
    }

    // Attempt to save detected fields (with LLM validation)
    const savedFields: string[] = [];
    const failedFields: Array<{ field: string; error: string }> = [];

    for (const fieldData of fieldsToSave) {
      const saveResult = await saveField(
        fieldData.field,
        fieldData.value,
        lastBotQuestion,
        role,
      );

      if (saveResult.success) {
        savedFields.push(fieldData.field);
        addToConversation(convoKey, {
          role: "system",
          content: `[Auto-saved: ${fieldData.field} = ${saveResult.extractedValue}]`,
        });
      } else if (saveResult.needsRetry) {
        failedFields.push({
          field: fieldData.field,
          error: saveResult.error || "Validation failed",
        });
      }
    }

    // If there were validation failures, return JSON error (not streaming)
    if (failedFields.length > 0) {
      const retryMessage = failedFields[0].error;
      return c.json(
        {
          success: false as const,
          error: retryMessage,
          needsRetry: true,
          fieldsFailed: failedFields.map((f) => f.field),
        },
        422,
      );
    }

    // STREAMING RESPONSE - Return raw Response
    return streamSSE(c, async (stream) => {
      let fullResponse = "";
      let chunkCount = 0;

      try {
        // Send initial event to signal start
        await stream.writeSSE({
          event: "start",
          data: JSON.stringify({ message: "Streaming started" }),
        });

        // Stream the AI response
        for await (const chunk of generateTextStreamFromModel(
          message,
          SYSTEM_PROMPT,
          storedHistory,
        )) {
          fullResponse += chunk;
          chunkCount++;

          await stream.writeSSE({
            event: "chunk",
            data: JSON.stringify({
              text: chunk,
              chunkIndex: chunkCount,
            }),
          });
        }

        // Check if bot response indicates completion
        const completionPhrases = [
          "perfect! you're all set",
          "you're all set",
          "profile is complete",
          "find the best matches for you",
          "help you find the best candidates",
        ];

        const isCompletionMessage = completionPhrases.some((phrase) =>
          fullResponse.toLowerCase().includes(phrase.toLowerCase()),
        );

        if (isCompletionMessage) {
          await markOnboardingComplete(userId, role);
        }

        // Persist conversation
        try {
          addToConversation(convoKey, { role: "user", content: message });
          addToConversation(convoKey, {
            role: "assistant",
            content: fullResponse,
          });
        } catch (err) {
          console.warn("Failed to persist conversation:", err);
        }

        // Send completion event
        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({
            message: "Stream completed",
            fullResponse: fullResponse,
            onboardingCompleted: isCompletionMessage,
            totalChunks: chunkCount,
          }),
        });
      } catch (err: any) {
        // Send error event
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: String(err?.message || err),
            errorType:
              err?.name === "ThrottlingException" ? "THROTTLING" : "UNKNOWN",
          }),
        });
      } finally {
        // Close the stream
        await stream.close();
      }
    });
  } catch (err: any) {
    if (err?.message === "Request timeout") {
      return c.json(
        {
          success: false as const,
          error:
            "The request took too long. Please try with a shorter message.",
          errorType: "TIMEOUT" as const,
        },
        408,
      );
    }

    if (err?.name === "ThrottlingException") {
      return c.json(
        {
          success: false as const,
          error:
            "The AI service is currently busy. Please try again in a moment.",
          errorType: "THROTTLING" as const,
        },
        429,
      );
    }

    return c.json(
      {
        success: false as const,
        error: String(err?.message || err),
      },
      500,
    );
  }
};
