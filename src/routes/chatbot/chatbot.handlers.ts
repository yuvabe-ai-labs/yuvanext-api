// chatbot.handlers.ts - Enhanced with Unit support

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { candidates } from "@/db/schema/candidate.schemas";
import { units } from "@/db/schema/unit.schemas";

import {
  addToConversation,
  detectAndExtractFields,
  generateTextFromModel,
  getConversation,
  getLastBotQuestion,
  validateAndExtractData,
} from "./chatbot.service";
import { CANDIDATE_SYSTEM_PROMPT, UNIT_SYSTEM_PROMPT } from "./prompts";

const ChatSchema = z.object({
  message: z.string().min(1),
});

export const chat: AppRouteHandler<any> = async (c) => {
  const json = await c.req.json().catch(() => ({}));
  const parsed = ChatSchema.safeParse(json);

  if (!parsed.success) {
    return c.json({ success: false, error: "Invalid request" }, 400);
  }

  const { message } = parsed.data;
  const user = c.get("user");

  const userId = user.id as string;
  const convoKey = userId;
  const role = user.role;

  let SYSTEM_PROMPT = CANDIDATE_SYSTEM_PROMPT;
  if (role === "unit") {
    SYSTEM_PROMPT = UNIT_SYSTEM_PROMPT;
  }

  // Helper function to ensure candidate record exists and check onboarding status
  const ensureCandidateExists = async (
    userId: string,
  ): Promise<{
    exists: boolean;
    onboardingCompleted: boolean;
  }> => {
    try {
      const existing = await db
        .select()
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
    } catch {
      return {
        exists: false,
        onboardingCompleted: false,
      };
    }
  };

  // NEW: Helper function to ensure unit record exists and check onboarding status
  const ensureUnitExists = async (
    userId: string,
  ): Promise<{
    exists: boolean;
    onboardingCompleted: boolean;
  }> => {
    try {
      const existing = await db
        .select()
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
    } catch {
      return {
        exists: false,
        onboardingCompleted: false,
      };
    }
  };

  // Helper function to mark candidate onboarding as completed
  const markCandidateOnboardingComplete = async (
    userId: string,
  ): Promise<boolean> => {
    try {
      await db
        .update(candidates)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(candidates.userId, userId));
      return true;
    } catch {
      return false;
    }
  };

  // NEW: Helper function to mark unit onboarding as completed
  const markUnitOnboardingComplete = async (
    userId: string,
  ): Promise<boolean> => {
    try {
      await db
        .update(units)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(units.userId, userId));
      return true;
    } catch {
      return false;
    }
  };

  // Field saving logic for CANDIDATES
  const saveCandidateField = async (
    field: string,
    value: any,
    lastQuestion: string,
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

      // Save to candidates table
      switch (field.toLowerCase()) {
        case "phone": {
          const _result = await db
            .update(candidates)
            .set({ phone: String(extractedValue || "") })
            .where(eq(candidates.userId, userId))
            .returning();
          break;
        }
        case "gender": {
          const genderValue = String(extractedValue || "").toLowerCase();
          const _result = await db
            .update(candidates)
            .set({ gender: genderValue as any })
            .where(eq(candidates.userId, userId))
            .returning();
          break;
        }
        case "experience_level": {
          const _result = await db
            .update(candidates)
            .set({ experienceLevel: String(extractedValue || "") })
            .where(eq(candidates.userId, userId))
            .returning();
          break;
        }
        case "skills": {
          let arr: string[] = [];
          if (Array.isArray(extractedValue)) {
            arr = extractedValue
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (typeof extractedValue === "string") {
            arr = extractedValue
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }

          const _result = await db
            .update(candidates)
            .set({ skills: arr })
            .where(eq(candidates.userId, userId))
            .returning();
          break;
        }
        case "interests": {
          let arr: string[] = [];
          if (Array.isArray(extractedValue)) {
            arr = extractedValue
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (typeof extractedValue === "string") {
            arr = extractedValue
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }

          const _result = await db
            .update(candidates)
            .set({ interests: arr })
            .where(eq(candidates.userId, userId))
            .returning();
          break;
        }
        case "type": {
          const typeValue = String(extractedValue || "").toLowerCase();
          const _result = await db
            .update(candidates)
            .set({ type: typeValue as any })
            .where(eq(candidates.userId, userId))
            .returning();
          break;
        }
        case "looking_for": {
          let arr: string[] = [];
          if (Array.isArray(extractedValue)) {
            arr = extractedValue
              .map(String)
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean);
          } else if (typeof extractedValue === "string") {
            arr = extractedValue
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean);
          }

          console.warn("DEBUG - lookingFor about to save:", {
            userId,
            extractedValue,
            processedArray: arr,
          });

          const result = await db
            .update(candidates)
            .set({ lookingFor: arr })
            .where(eq(candidates.userId, userId))
            .returning();

          console.warn("DEBUG - lookingFor save result:", result);

          if (result.length === 0) {
            throw new Error("No candidate record found to update");
          }

          break;
        }

        default:
          return { success: false, error: "Field not supported" };
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

  // NEW: Field saving logic for UNITS
  const saveUnitField = async (
    field: string,
    value: any,
    lastQuestion: string,
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

      // Save to units table
      switch (field.toLowerCase()) {
        case "name": {
          const _result = await db
            .update(units)
            .set({ name: String(extractedValue || "") })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }
        case "type": {
          const _result = await db
            .update(units)
            .set({ type: String(extractedValue || "") })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }
        case "phone": {
          const _result = await db
            .update(units)
            .set({ phone: String(extractedValue || "") })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }
        case "location": {
          const _result = await db
            .update(units)
            .set({ location: String(extractedValue || "") })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }
        case "focus_areas": {
          let arr: string[] = [];
          if (Array.isArray(extractedValue)) {
            arr = extractedValue
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (typeof extractedValue === "string") {
            arr = extractedValue
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }

          const _result = await db
            .update(units)
            .set({ focusAreas: arr })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }
        case "skills_offered": {
          let arr: string[] = [];
          if (Array.isArray(extractedValue)) {
            arr = extractedValue
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (typeof extractedValue === "string") {
            arr = extractedValue
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }

          const _result = await db
            .update(units)
            .set({ skillsOffered: arr })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }
        case "is_aurovillian": {
          const boolValue =
            String(extractedValue || "").toLowerCase() === "true" ||
            String(extractedValue || "").toLowerCase() === "yes" ||
            String(extractedValue || "").toLowerCase() === "aurovillian";

          const _result = await db
            .update(units)
            .set({ isAurovillian: boolValue })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }
        case "opportunities_offered": {
          let arr: string[] = [];
          if (Array.isArray(extractedValue)) {
            arr = extractedValue
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (typeof extractedValue === "string") {
            arr = extractedValue
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }

          const _result = await db
            .update(units)
            .set({ opportunitiesOffered: arr })
            .where(eq(units.userId, userId))
            .returning();
          break;
        }

        default:
          return { success: false, error: "Field not supported" };
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
    // Check if candidate/unit exists and onboarding status
    let onboardingStatus: { exists: boolean; onboardingCompleted: boolean };

    if (role === "candidate") {
      onboardingStatus = await ensureCandidateExists(userId);
    } else if (role === "unit") {
      onboardingStatus = await ensureUnitExists(userId);
    } else {
      return c.json(
        {
          success: false,
          error: "Invalid user role",
        },
        400,
      );
    }

    if (!onboardingStatus.exists) {
      return c.json(
        {
          success: false,
          error: `Failed to access ${role} profile`,
        },
        500,
      );
    }

    // If onboarding is already completed, return static message
    if (onboardingStatus.onboardingCompleted) {
      const completionMessage =
        role === "candidate"
          ? "You have already completed the onboarding process! Your profile is all set up. You can now explore internships, courses, and opportunities on the platform."
          : "You have already completed the unit registration! Your unit profile is all set up. You can now start posting opportunities and finding candidates.";

      return c.json({
        success: true,
        response: completionMessage,
        onboardingCompleted: true,
        skipQuestions: true,
      });
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
          role, // Pass role to detection
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
      // Use appropriate save function based on role
      const saveResult =
        role === "candidate"
          ? await saveCandidateField(
              fieldData.field,
              fieldData.value,
              lastBotQuestion,
            )
          : await saveUnitField(
              fieldData.field,
              fieldData.value,
              lastBotQuestion,
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

    // If there were validation failures, return retry prompt
    if (failedFields.length > 0) {
      const retryMessage = failedFields[0].error;
      return c.json(
        {
          success: false,
          error: retryMessage,
          needsRetry: true,
          fieldsFailed: failedFields.map((f) => f.field),
        },
        400,
      );
    }

    // Generate bot response
    const resultPromise = generateTextFromModel(
      message,
      SYSTEM_PROMPT,
      storedHistory,
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), 55000),
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);

    const botResponse = (result as any)?.text;
    if (!botResponse) {
      throw new Error("No response from model");
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
      botResponse.toLowerCase().includes(phrase.toLowerCase()),
    );

    if (isCompletionMessage) {
      if (role === "candidate") {
        await markCandidateOnboardingComplete(userId);
      } else if (role === "unit") {
        await markUnitOnboardingComplete(userId);
      }
    }

    // Persist conversation
    try {
      addToConversation(convoKey, { role: "user", content: message });
      addToConversation(convoKey, { role: "assistant", content: botResponse });
    } catch (err) {
      console.warn("Failed to persist conversation:", err);
    }

    return c.json({
      success: true,
      response: botResponse
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
        .trim(),
      ...(isCompletionMessage && { onboardingCompleted: true }),
    });
  } catch (err: any) {
    if (err?.message === "Request timeout") {
      return c.json(
        {
          success: false,
          error:
            "The request took too long. Please try with a shorter message.",
          errorType: "TIMEOUT",
        },
        408,
      );
    }

    if (err?.name === "ThrottlingException") {
      return c.json(
        {
          success: false,
          error:
            "The AI service is currently busy. Please try again in a moment.",
          errorType: "THROTTLING",
        },
        429,
      );
    }

    return c.json({ success: false, error: String(err?.message || err) }, 500);
  }
};
