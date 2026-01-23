// chatbot.handlers.ts - Structured output handler

import { eq } from "drizzle-orm";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";

import db from "@/db";
import { candidates } from "@/db/schema/candidate.schema";
import { units } from "@/db/schema/unit.schema";

import {
  addToConversation,
  detectAndExtractFields,
  generateStructuredStreamFromModel,
  getConversation,
  getLastBotQuestion,
  validateAndExtractData,
  type StructuredBotResponse,
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
          .select({ onboardingCompleted: candidates.onboardingCompleted })
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

        return { exists: true, onboardingCompleted: false };
      } else {
        const existing = await db
          .select({ onboardingCompleted: units.onboardingCompleted })
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

        return { exists: true, onboardingCompleted: false };
      }
    } catch {
      return { exists: false, onboardingCompleted: false };
    }
  };

  const markOnboardingComplete = async (
    userId: string,
    role: "candidate" | "unit",
  ): Promise<boolean> => {
    try {
      if (role === "candidate") {
        await db
          .update(candidates)
          .set({ onboardingCompleted: true, updatedAt: new Date() })
          .where(eq(candidates.userId, userId));
      } else {
        await db
          .update(units)
          .set({ onboardingCompleted: true, updatedAt: new Date() })
          .where(eq(units.userId, userId));
      }
      return true;
    } catch {
      return false;
    }
  };

  const saveField = async (
    field: string,
    value: any,
    lastQuestion: string,
    role: "candidate" | "unit",
  ) => {
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
        };
      }

      const extractedValue = validationResult.extractedValue;

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

      if (role === "candidate") {
        switch (field.toLowerCase()) {
          case "phone":
            await db
              .update(candidates)
              .set({ phone: String(extractedValue || "") })
              .where(eq(candidates.userId, userId));
            break;
          case "gender":
            await db
              .update(candidates)
              .set({
                gender: String(extractedValue || "").toLowerCase() as any,
              })
              .where(eq(candidates.userId, userId));
            break;
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
          case "type":
            await db
              .update(candidates)
              .set({ type: String(extractedValue || "").toLowerCase() as any })
              .where(eq(candidates.userId, userId));
            break;
          case "looking_for":
            await db
              .update(candidates)
              .set({
                lookingFor: toArray(extractedValue).map((s) => s.toLowerCase()),
              })
              .where(eq(candidates.userId, userId));
            break;
          default:
            return { success: false, error: "Field not supported" };
        }
      } else {
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
          case "is_aurovillian":
            await db
              .update(units)
              .set({
                isAurovillian:
                  String(extractedValue || "").toLowerCase() === "yes",
              })
              .where(eq(units.userId, userId));
            break;
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
      };
    }
  };

  try {
    if (role !== "candidate" && role !== "unit") {
      return c.json(
        { success: false as const, error: "Invalid user role" },
        422,
      );
    }

    const onboardingStatus = await ensureProfileExists(userId, role);

    if (!onboardingStatus.exists) {
      return c.json(
        { success: false as const, error: `Failed to access ${role} profile` },
        500,
      );
    }

    if (onboardingStatus.onboardingCompleted) {
      const completionMessage =
        role === "candidate"
          ? "You have already completed the onboarding process!"
          : "You have already completed the unit registration!";

      return c.json(
        {
          success: true as const,
          response: {
            message: completionMessage,
            question: null,
            options: null,
            fieldType: null,
            isComplete: true,
          },
          onboardingCompleted: true,
        },
        200,
      );
    }

    const storedHistory = getConversation(convoKey);
    const lastBotQuestion = getLastBotQuestion(convoKey);

    // Auto-detect and save fields
    let fieldsToSave: Array<{ field: string; value: any }> = [];

    if (lastBotQuestion) {
      try {
        const detection = await detectAndExtractFields(
          message,
          lastBotQuestion,
          storedHistory,
          role,
        );
        fieldsToSave = detection.fieldsDetected
          .filter((f) => f.confidence > 0.7)
          .map((f) => ({ field: f.field, value: f.value }));
      } catch {
        // Continue without auto-save
      }
    }

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
          content: `[Auto-saved: ${fieldData.field}]`,
        });
      } else if (saveResult.needsRetry) {
        failedFields.push({
          field: fieldData.field,
          error: saveResult.error || "Validation failed",
        });
      }
    }

    if (failedFields.length > 0) {
      return c.json(
        {
          success: false as const,
          error: failedFields[0].error,
          needsRetry: true,
          fieldsFailed: failedFields.map((f) => f.field),
        },
        422,
      );
    }

    // STRUCTURED STREAMING RESPONSE
    return streamSSE(c, async (stream) => {
      let structuredResponse: StructuredBotResponse | null = null;

      try {
        await stream.writeSSE({
          event: "start",
          data: JSON.stringify({ message: "Streaming started" }),
        });

        // Get structured response from model
        for await (const response of generateStructuredStreamFromModel(
          message,
          SYSTEM_PROMPT,
          storedHistory,
        )) {
          structuredResponse = response;

          // Send the complete structured response
          await stream.writeSSE({
            event: "structured",
            data: JSON.stringify(response),
          });
        }

        if (!structuredResponse) {
          throw new Error("No response from model");
        }

        // Check completion
        const isComplete = structuredResponse.isComplete || false;

        if (isComplete) {
          await markOnboardingComplete(userId, role);
        }

        // Persist conversation
        try {
          addToConversation(convoKey, { role: "user", content: message });
          addToConversation(convoKey, {
            role: "assistant",
            content: JSON.stringify(structuredResponse),
          });
        } catch (err) {
          console.warn("Failed to persist conversation:", err);
        }

        // Send completion event
        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({
            message: "Stream completed",
            structuredResponse,
            onboardingCompleted: isComplete,
          }),
        });
      } catch (err: any) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: String(err?.message || err),
            errorType:
              err?.name === "ThrottlingException" ? "THROTTLING" : "UNKNOWN",
          }),
        });
      } finally {
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
