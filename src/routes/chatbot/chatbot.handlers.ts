// chatbot.handlers.ts - Restructured handler with batch DB save on completion

import { eq } from "drizzle-orm";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";

import db from "@/db";
import { candidates } from "@/db/schema/candidate.schema";
import { units } from "@/db/schema/unit.schema";

import {
  addMessage,
  addExtractedField,
  clearConversation,
  detectAndExtractFields,
  generateStructuredStreamFromModel,
  getExtractedData,
  getLastBotQuestion,
  getMessages,
  initializeConversation,
  printConversation,
  validateAndExtractData,
  type ExtractedFieldData,
  type StructuredBotResponse,
} from "./chatbot.service";
import { CANDIDATE_SYSTEM_PROMPT, UNIT_SYSTEM_PROMPT } from "./prompts";

/**
 * Main chat handler for onboarding chatbot
 * Stores data in-memory during conversation, saves to DB only on completion
 */
export const chat = async (c: Context) => {
  const body = await c.req.json();
  const { message } = body;

  const user = c.get("user");
  const userId = user.id as string;
  const role = user.role;

  // Select appropriate system prompt based on role
  let SYSTEM_PROMPT = CANDIDATE_SYSTEM_PROMPT;
  if (role === "unit") {
    SYSTEM_PROMPT = UNIT_SYSTEM_PROMPT;
  }

  /**
   * Check if profile exists and return onboarding status
   */
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
            onboardingCompleted: existing[0].onboardingCompleted,
          };
        }

        return { exists: false, onboardingCompleted: false };
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

        return { exists: false, onboardingCompleted: false };
      }
    } catch (error) {
      console.error(
        `[Profile Check Error] userId: ${userId}, role: ${role}`,
        error,
      );
      return { exists: false, onboardingCompleted: false };
    }
  };

  /**
   * Helper to convert values to string array
   */
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

  /**
   * Save all extracted data to database (called only on completion)
   */
  const saveAllDataToDatabase = async (
    userId: string,
    role: "candidate" | "unit",
    extractedData: ExtractedFieldData,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`[Saving All Data] userId: ${userId}, role: ${role}`);
      console.log(`[Data to Save]`, extractedData);

      if (role === "candidate") {
        const updateData: any = {
          onboardingCompleted: true,
          updatedAt: new Date(),
        };

        // Map extracted fields to database columns
        if (extractedData.phone) updateData.phone = String(extractedData.phone);
        if (extractedData.gender)
          updateData.gender = String(extractedData.gender).toLowerCase();
        if (extractedData.grade) updateData.grade = String(extractedData.grade);
        if (extractedData.experience_level)
          updateData.experienceLevel = String(extractedData.experience_level);
        if (extractedData.skills)
          updateData.skills = toArray(extractedData.skills);
        if (extractedData.interests)
          updateData.interests = toArray(extractedData.interests);
        if (extractedData.type)
          updateData.type = String(extractedData.type).toLowerCase();
        if (extractedData.looking_for)
          updateData.lookingFor = toArray(extractedData.looking_for).map((s) =>
            s.toLowerCase(),
          );

        await db
          .update(candidates)
          .set(updateData)
          .where(eq(candidates.userId, userId));

        console.log(
          `[Candidate Data Saved] userId: ${userId}, fields: ${Object.keys(updateData).join(", ")}`,
        );
      } else {
        const updateData: any = {
          onboardingCompleted: true,
          updatedAt: new Date(),
        };

        // Map extracted fields to database columns
        if (extractedData.name) updateData.name = String(extractedData.name);
        if (extractedData.type) updateData.type = String(extractedData.type);
        if (extractedData.phone) updateData.phone = String(extractedData.phone);
        if (extractedData.location)
          updateData.location = String(extractedData.location);
        if (extractedData.focus_areas)
          updateData.focusAreas = toArray(extractedData.focus_areas);
        if (extractedData.skills_offered)
          updateData.skillsOffered = toArray(extractedData.skills_offered);
        if (extractedData.is_aurovillian !== undefined) {
          updateData.isAurovillian =
            String(extractedData.is_aurovillian).toLowerCase() === "yes";
        }
        if (extractedData.opportunities_offered)
          updateData.opportunitiesOffered = toArray(
            extractedData.opportunities_offered,
          );

        await db.update(units).set(updateData).where(eq(units.userId, userId));

        console.log(
          `[Unit Data Saved] userId: ${userId}, fields: ${Object.keys(updateData).join(", ")}`,
        );
      }

      return { success: true };
    } catch (err) {
      console.error(`[Save All Data Error] userId: ${userId}`, err);
      return {
        success: false,
        error: String(err instanceof Error ? err.message : "Database error"),
      };
    }
  };

  /**
   * Validate and store field in memory (not DB yet)
   */
  const validateAndStoreField = async (
    userId: string,
    field: string,
    value: any,
    lastQuestion: string,
    role: "candidate" | "unit",
  ): Promise<{ success: boolean; error?: string; extractedValue?: any }> => {
    try {
      // Validate the field value
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
        };
      }

      const extractedValue = validationResult.extractedValue;

      // Store in memory (not DB)
      addExtractedField(userId, field, extractedValue);

      return { success: true, extractedValue };
    } catch (err) {
      console.error(
        `[Validate Field Error] userId: ${userId}, field: ${field}`,
        err,
      );
      return {
        success: false,
        error: String(err instanceof Error ? err.message : "Validation error"),
      };
    }
  };

  try {
    // Validate role
    if (role !== "candidate" && role !== "unit") {
      return c.json(
        { success: false as const, error: "Invalid user role" },
        422,
      );
    }

    // Check onboarding status
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

    // Initialize conversation if needed
    initializeConversation(userId);

    // Add user message to conversation array
    addMessage(userId, "user", message);
    console.log(`[User Message] userId: ${userId}, message: "${message}"`);

    // Get conversation history and last question
    const conversationHistory = getMessages(userId);
    const lastBotQuestion = getLastBotQuestion(userId);

    // Auto-detect and validate fields from user's response
    let fieldsToValidate: Array<{ field: string; value: any }> = [];

    if (lastBotQuestion) {
      try {
        const detection = await detectAndExtractFields(
          message,
          lastBotQuestion,
          conversationHistory,
          role,
        );
        fieldsToValidate = detection.fieldsDetected
          .filter((f) => f.confidence > 0.7)
          .map((f) => ({ field: f.field, value: f.value }));

        if (fieldsToValidate.length > 0) {
          console.log(
            `[Fields Detected] userId: ${userId}, fields:`,
            fieldsToValidate.map((f) => f.field),
          );
        }
      } catch (error) {
        console.error(`[Field Detection Error] userId: ${userId}`, error);
      }
    }

    // Validate and store fields in memory
    const failedFields: Array<{ field: string; error: string }> = [];

    for (const fieldData of fieldsToValidate) {
      const validationResult = await validateAndStoreField(
        userId,
        fieldData.field,
        fieldData.value,
        lastBotQuestion,
        role,
      );

      if (!validationResult.success) {
        failedFields.push({
          field: fieldData.field,
          error: validationResult.error || "Validation failed",
        });
      } else {
        // Add system message about field extraction
        addMessage(userId, "system", `[Extracted: ${fieldData.field}]`);
      }
    }

    // Return validation error if any fields failed
    if (failedFields.length > 0) {
      console.log(
        `[Validation Failed] userId: ${userId}, fields:`,
        failedFields,
      );
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

    // Stream structured response
    return streamSSE(c, async (stream) => {
      let structuredResponse: StructuredBotResponse | null = null;

      try {
        await stream.writeSSE({
          event: "start",
          data: JSON.stringify({ message: "Streaming started" }),
        });

        // Generate structured response from model
        for await (const response of generateStructuredStreamFromModel(
          conversationHistory,
          SYSTEM_PROMPT,
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

        // Add assistant response to conversation array
        addMessage(userId, "assistant", structuredResponse.message);
        console.log(
          `[Bot Response] userId: ${userId}, isComplete: ${structuredResponse.isComplete || false}`,
        );

        // Check if onboarding is complete
        const isComplete = structuredResponse.isComplete || false;

        if (isComplete) {
          // NOW save all data to database
          const extractedData = getExtractedData(userId);
          const saveResult = await saveAllDataToDatabase(
            userId,
            role,
            extractedData,
          );

          if (!saveResult.success) {
            throw new Error(
              saveResult.error || "Failed to save data to database",
            );
          }

          console.log(`[Onboarding Complete] userId: ${userId}, role: ${role}`);

          // Optional: Print final conversation for debugging
          if (process.env.NODE_ENV === "development") {
            printConversation(userId);
          }

          // Clear conversation from memory after successful save
          clearConversation(userId);
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
        console.error(`[Stream Error] userId: ${userId}`, err);

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
    console.error(`[Handler Error] userId: ${userId}`, err);

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
