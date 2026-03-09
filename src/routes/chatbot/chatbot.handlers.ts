// chatbot.handlers.ts - Restructured handler with batch DB save on completion

import { eq } from "drizzle-orm";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";

import db from "@/db";
import { candidates } from "@/db/schema/candidate.schema";
import { mentors } from "@/db/schema/mentor.schema";
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
  resetConversation,
  printConversation,
  validateAndExtractData,
  type ExtractedFieldData,
  type StructuredBotResponse,
} from "./chatbot.service";
import {
  CANDIDATE_SYSTEM_PROMPT,
  UNIT_SYSTEM_PROMPT,
  MENTOR_SYSTEM_PROMPT,
} from "./prompts";

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

  let SYSTEM_PROMPT = CANDIDATE_SYSTEM_PROMPT;
  if (role === "unit") {
    SYSTEM_PROMPT = UNIT_SYSTEM_PROMPT;
  } else if (role === "mentor") {
    SYSTEM_PROMPT = MENTOR_SYSTEM_PROMPT;
  }

  /**
   * Check if profile exists and return onboarding status
   */
  const ensureProfileExists = async (
    userId: string,
    role: "candidate" | "unit" | "mentor",
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
      } else if (role === "mentor") {
        const existing = await db
          .select({ onboardingCompleted: mentors.onboardingCompleted })
          .from(mentors)
          .where(eq(mentors.userId, userId))
          .limit(1);

        if (existing.length > 0) {
          return {
            exists: true,
            onboardingCompleted: existing[0].onboardingCompleted || false,
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
    role: "candidate" | "unit" | "mentor",
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
      } else if (role === "mentor") {
        const updateData: any = {
          onboardingCompleted: true,
          updatedAt: new Date(),
        };

        if (extractedData.mentor_type) {
          const mentorTypeMap: Record<string, string> = {
            "career guidance mentor": "career_guidance",
            "internship application support mentor": "internship_support",
            "skills & portfolio mentor": "skills_portfolio",
            "skills and portfolio mentor": "skills_portfolio",
            "wellbeing & confidence mentor": "wellbeing_confidence",
            "wellbeing and confidence mentor": "wellbeing_confidence",
            "general mentor": "general",
          };
          const mentorTypeStr = String(extractedData.mentor_type)
            .toLowerCase()
            .trim();
          updateData.mentorType = mentorTypeMap[mentorTypeStr] || "general";
          console.log(
            `[Mentor Type Mapping] userId: ${userId}, original: ${extractedData.mentor_type}, mapped: ${updateData.mentorType}`,
          );
        }

        if (extractedData.expertise_areas)
          updateData.expertiseAreas = toArray(extractedData.expertise_areas);

        if (extractedData.experience_snapshot)
          updateData.experienceSnapshot = String(
            extractedData.experience_snapshot,
          );

        if (extractedData.availability_days)
          updateData.availabilityDays = toArray(
            extractedData.availability_days,
          );

        // Debug log to inspect the structure of availability_time_windows
        console.log(
          `[Debug] availability_time_windows before saving:`,
          extractedData.availability_time_windows,
        );

        if (extractedData.availability_time_windows) {
          // Serialize the availability_time_windows field if it's an object or array
          updateData.availabilityTimeWindows =
            typeof extractedData.availability_time_windows === "object"
              ? JSON.stringify(extractedData.availability_time_windows)
              : extractedData.availability_time_windows;
        }

        // Log the normalized availability_time_windows for debugging
        console.log(
          `[Availability Time Windows] userId: ${userId}, normalized:`,
          updateData.availabilityTimeWindows,
        );

        if (extractedData.mentoring_capacity) {
          // FIX: Normalize dashes at save time as a final safety net
          const capacityStr = String(extractedData.mentoring_capacity)
            .toLowerCase()
            .replace(/\u2013|\u2014|–|—/g, "-")
            .trim();
          updateData.mentoringCapacity = capacityStr;
          console.log(
            `[Capacity Mapping] userId: ${userId}, original: ${extractedData.mentoring_capacity}, mapped: ${capacityStr}`,
          );
        }

        if (extractedData.preferred_stages)
          updateData.preferredStages = toArray(extractedData.preferred_stages);

        if (extractedData.communication_modes)
          updateData.communicationModes = toArray(
            extractedData.communication_modes,
          );

        if (extractedData.timezone)
          updateData.timezone = String(extractedData.timezone);

        // FIX: confirm_boundaries was extracted but never mapped to DB
        if (extractedData.confirm_boundaries !== undefined) {
          updateData.confirmBoundaries =
            extractedData.confirm_boundaries === true ||
            String(extractedData.confirm_boundaries).toLowerCase() === "true" ||
            String(extractedData.confirm_boundaries).toLowerCase() === "yes";
        }

        await db
          .update(mentors)
          .set(updateData)
          .where(eq(mentors.userId, userId));

        console.log(
          `[Mentor Data Saved] userId: ${userId}, fields: ${Object.keys(updateData).join(", ")}`,
        );
      } else {
        const updateData: any = {
          onboardingCompleted: true,
          updatedAt: new Date(),
        };

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
    role: "candidate" | "unit" | "mentor",
  ): Promise<{ success: boolean; error?: string; extractedValue?: any }> => {
    try {
      // Do NOT coerce value to String here — for fields like availability_time_windows
      // the detector may return an object/array, and String() would corrupt it to "[object Object]".
      // validateAndExtractData accepts `any` and handles type-specific logic internally.
      const rawValue = value ?? "";
      const validationResult = await validateAndExtractData(
        rawValue,
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
    if (role !== "candidate" && role !== "unit" && role !== "mentor") {
      return c.json(
        { success: false as const, error: "Invalid user role" },
        422,
      );
    }

    const onboardingStatus = await ensureProfileExists(userId, role);

    if (!onboardingStatus.exists) {
      if (role === "candidate") {
        try {
          await db.insert(candidates).values({
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            onboardingCompleted: false,
          });
          console.log(
            `[Profile Auto-Created] userId: ${userId}, role: ${role}`,
          );
        } catch (err) {
          console.error(
            `[Profile Creation Error] userId: ${userId}, role: ${role}`,
            err,
          );
          return c.json(
            {
              success: false as const,
              error: `Failed to access or create ${role} profile. Please contact support.`,
            },
            500,
          );
        }
      } else if (role === "mentor") {
        try {
          await db.insert(mentors).values({
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            onboardingCompleted: false,
          });
          console.log(
            `[Profile Auto-Created] userId: ${userId}, role: ${role}`,
          );
        } catch (err) {
          console.error(
            `[Profile Creation Error] userId: ${userId}, role: ${role}`,
            err,
          );
          return c.json(
            {
              success: false as const,
              error: `Failed to access or create ${role} profile. Please contact support.`,
            },
            500,
          );
        }
      } else if (role === "unit") {
        try {
          await db.insert(units).values({
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            onboardingCompleted: false,
          });
          console.log(
            `[Profile Auto-Created] userId: ${userId}, role: ${role}`,
          );
        } catch (err) {
          console.error(
            `[Profile Creation Error] userId: ${userId}, role: ${role}`,
            err,
          );
          return c.json(
            {
              success: false as const,
              error: `Failed to access or create ${role} profile. Please contact support.`,
            },
            500,
          );
        }
      }
    }

    if (onboardingStatus.onboardingCompleted) {
      const completionMessage =
        role === "candidate"
          ? "You have already completed the onboarding process!"
          : role === "mentor"
            ? "You have already completed the mentor profile setup!"
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

    // FIX: Detect if this is the first message ("hi", "hello", "start", etc.).
    // If so, reset the conversation so stale extracted data from a previous
    // incomplete session doesn't persist. This prevents wrong field values
    // (e.g. old timezone) from leaking into the new save.
    const isGreeting = /^\s*(hi|hello|hey|start|begin|ok|okay|sure)\s*$/i.test(
      message,
    );
    if (isGreeting) {
      resetConversation(userId);
    } else {
      initializeConversation(userId);
    }

    addMessage(userId, "user", message);
    console.log(`[User Message] userId: ${userId}, message: "${message}"`);

    const conversationHistory = getMessages(userId);
    const lastBotQuestion = getLastBotQuestion(userId);

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

    const failedFields: Array<{ field: string; error: string }> = [];
    const successfulFields: string[] = [];

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
        addMessage(
          userId,
          "system",
          `[Invalid Input] The response for "${fieldData.field}" was invalid. Reason: ${validationResult.error}. Please politely ask the user to provide the information again with clear guidance on the expected format. Do NOT accept this answer - ask the SAME question again.`,
        );
        console.log(
          `[Field Validation Failed - Re-asking] userId: ${userId}, field: ${fieldData.field}, reason: ${validationResult.error}`,
        );
      } else {
        addMessage(userId, "system", `[Extracted: ${fieldData.field}]`);
        successfulFields.push(fieldData.field);
      }
    }

    if (failedFields.length > 0) {
      console.log(
        `[Validation Summary] userId: ${userId}, successful: ${successfulFields.length}, failed: ${failedFields.length} - re-asking failed questions`,
      );
    }

    return streamSSE(c, async (stream) => {
      let structuredResponse: StructuredBotResponse | null = null;

      try {
        await stream.writeSSE({
          event: "start",
          data: JSON.stringify({ message: "Streaming started" }),
        });

        for await (const response of generateStructuredStreamFromModel(
          conversationHistory,
          SYSTEM_PROMPT,
        )) {
          structuredResponse = response;

          await stream.writeSSE({
            event: "structured",
            data: JSON.stringify(response),
          });
        }

        if (!structuredResponse) {
          throw new Error("No response from model");
        }

        addMessage(userId, "assistant", structuredResponse.message);
        console.log(
          `[Bot Response] userId: ${userId}, isComplete: ${structuredResponse.isComplete || false}`,
        );

        const isComplete = structuredResponse.isComplete || false;

        if (isComplete) {
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

          if (process.env.NODE_ENV === "development") {
            printConversation(userId);
          }

          clearConversation(userId);
        }

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
