// chatbot.service.ts - Enhanced with streaming support

import type { Readable } from "node:stream";

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Buffer } from "node:buffer";

import env from "@/config/env";

const AWS_REGION = env.AWS_REGION;
const DEFAULT_MODEL = env.BEDROCK_MODEL_ID;

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const maybeCredentials =
  !isLambda && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const client = new BedrockRuntimeClient({
  region: AWS_REGION,
  ...(maybeCredentials ? { credentials: maybeCredentials } : {}),
});

async function streamToString(stream: Readable | Uint8Array): Promise<string> {
  if (stream instanceof Uint8Array)
    return Buffer.from(stream).toString("utf-8");

  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

// NEW: Streaming generator function - EXPORTED
export async function* generateTextStreamFromModel(
  prompt: string,
  systemPrompt: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): AsyncGenerator<string, void, unknown> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    for (const m of conversationHistory) {
      if (m && m.role && typeof m.content === "string") messages.push(m);
    }
  }

  messages.push({ role: "user", content: prompt });

  const payload = {
    messages,
    max_tokens: 1000,
    temperature: 0.7,
  };

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: DEFAULT_MODEL,
    body: JSON.stringify(payload),
  });

  try {
    const response = await client.send(command);

    if (!response.body) {
      throw new Error("No response body from streaming model");
    }

    for await (const event of response.body) {
      if (event.chunk?.bytes) {
        try {
          const chunk = JSON.parse(
            Buffer.from(event.chunk.bytes).toString("utf-8"),
          );
          const text = chunk?.choices?.[0]?.delta?.content || "";

          if (text) {
            // Remove reasoning tags in real-time
            const cleanedText = text.replace(
              /<reasoning>[\s\S]*?<\/reasoning>/gi,
              "",
            );
            if (cleanedText) {
              yield cleanedText;
            }
          }
        } catch (parseErr) {
          console.error("Failed to parse streaming chunk:", parseErr);
          // Continue to next chunk
        }
      }
    }
  } catch (error) {
    console.error("Streaming error:", error);
    throw error;
  }
}

// KEEP: Non-streaming version for field detection and validation
export async function generateTextFromModel(
  prompt: string,
  systemPrompt: string,
  conversationHistory?: Array<{ role: string; content: string }>,
) {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    for (const m of conversationHistory) {
      if (m && m.role && typeof m.content === "string") messages.push(m);
    }
  }

  messages.push({ role: "user", content: prompt });

  const payload = {
    messages,
    max_tokens: 1000,
    temperature: 0.7,
  };

  const command = new InvokeModelCommand({
    modelId: DEFAULT_MODEL,
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const decodedBody = await streamToString(response.body as any);

  let json;
  try {
    json = JSON.parse(decodedBody);
  } catch {
    console.error("Failed to parse Bedrock response:", decodedBody);
    throw new Error("Invalid JSON from model");
  }

  const rawText = json?.choices?.[0]?.message?.content || "";
  const text = rawText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").trim();

  return { text };
}

// Enhanced: Auto-detect fields from conversation context (supports both candidate and unit)
export async function detectAndExtractFields(
  userMessage: string,
  lastBotQuestion: string,
  conversationHistory: Array<{ role: string; content: string }>,
  role: string = "candidate",
): Promise<{
  fieldsDetected: Array<{
    field: string;
    value: any;
    confidence: number;
  }>;
}> {
  // Define fields based on role
  const candidateFields = `
- phone: Phone number
- gender: Gender (male, female, other, prefer not to say)
- grade: School grade/class (9th, 10th, 11th, 12th, other)
- experience_level: Experience level
- skills: Skills (array of strings)
- interests: Interests (array of strings)
- type: Profile type (student, fresher, working, graduate)
- looking_for: What they're looking for (courses, internships, job opportunities, just exploring)`;

  const unitFields = `
- name: Unit/organization name
- type: Type of unit/organization
- phone: Phone number
- location: City/location
- focus_areas: Focus areas (array of strings)
- skills_offered: Skills offered (array of strings)
- is_aurovillian: Whether unit is Aurovillian (boolean: yes/no)
- opportunities_offered: Opportunities offered (array of strings)`;

  const fieldsDefinition = role === "unit" ? unitFields : candidateFields;

  const detectionPrompt = `
You are an intelligent field extractor for a recruitment chatbot.

Conversation History:
${conversationHistory
  .slice(-6)
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n")}

Last Bot Question: "${lastBotQuestion}"
User's Answer: "${userMessage}"

Your task is to detect what profile field(s) the user is answering and extract the value(s).

Possible fields for ${role}:
${fieldsDefinition}

Return ONLY a JSON object with this structure:
{
  "fieldsDetected": [
    {
      "field": "field_name",
      "value": "extracted_value",
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Only include fields you're confident about (confidence > 0.7)
- For skills/interests/arrays, return as array
- For single values, return as string
- For boolean (is_aurovillian), return "yes" or "no"
- Return empty array if no clear field detected
- Match field names exactly as listed above
`;

  const messages = [{ role: "user", content: detectionPrompt }];

  const payload = {
    messages,
    max_tokens: 500,
    temperature: 0.3,
  };

  const command = new InvokeModelCommand({
    modelId: DEFAULT_MODEL,
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const decodedBody = await streamToString(response.body as any);

  let json;
  try {
    json = JSON.parse(decodedBody);
  } catch {
    console.error("Failed to parse detection response:", decodedBody);
    return { fieldsDetected: [] };
  }

  const rawText = json?.choices?.[0]?.message?.content || "{}";
  try {
    // Clean common wrapper text the model may include
    let cleaned = rawText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
    cleaned = cleaned.replace(/```/g, "").trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return { fieldsDetected: [] };
    }

    const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
    const result = JSON.parse(jsonStr);
    return {
      fieldsDetected: result.fieldsDetected || [],
    };
  } catch (_err) {
    console.error("Failed to parse field detection result:", rawText, _err);
    return { fieldsDetected: [] };
  }
}

// Enhanced validator with support for unit fields
export async function validateAndExtractData(
  userInput: string,
  question: string,
  expectedField: string,
  role: string = "candidate",
): Promise<{
  isValid: boolean;
  extractedValue?: any;
  validationMessage: string;
}> {
  const fieldValidationRules: Record<string, string> = {
    // Candidate fields
    phone: "Valid phone number (10 digits, may include country code)",
    gender: "Must be one of: male, female, other, prefer not to say",
    grade: "School grade (9th, 10th, 11th, 12th, or other)",
    experience_level: "Experience level or grade",
    skills: "Comma-separated list of skills (minimum 1)",
    interests: "Comma-separated list of interests (minimum 1)",
    looking_for:
      "One or more of: courses, internships, job opportunities, just exploring (accept semantic matches like 'want to explore', 'need to check out', etc.)",
    location: "Valid city or location name",

    // Unit fields
    name: "Valid organization or unit name (non-empty string)",
    focus_areas: "Comma-separated list of focus areas (minimum 1)",
    skills_offered: "Comma-separated list of skills offered (minimum 1)",
    is_aurovillian:
      "Must be yes/no or true/false or aurovillian/non-aurovillian",
    opportunities_offered: "Comma-separated list of opportunities (minimum 1)",
  };

  // Determine validation rule for this field, accounting for role-specific cases
  let validationRule = fieldValidationRules[expectedField] || "Valid input";

  if (expectedField === "type") {
    if (role === "candidate") {
      validationRule = "Must be one of: student, fresher, working, graduate";
    } else if (role === "unit") {
      validationRule =
        "Non-empty string describing unit type (e.g., NGO, Company, School, Service)";
    }
  }

  const validationPrompt = `
You are a strict but intelligent data validator for a recruitment system.

Question asked: "${question}"
Expected field: "${expectedField}"
Validation rule: ${validationRule}
User's answer: "${userInput}"

Your task:
1. Validate if the answer matches the expected field and rules
2. Extract the exact value to store in database
3. Provide clear feedback if invalid

**IMPORTANT SEMANTIC MATCHING RULES:**

For "looking_for" field specifically:
- Allowed database values: ["courses", "internships", "job opportunities", "just exploring"]
- Accept semantic variations and map them to the closest allowed value:
  * "explore", "want to explore", "need to explore", "exploring" → "just exploring"
  * "course", "learning", "training" → "courses"
  * "internship", "intern" → "internships"
  * "job", "work", "employment", "career" → "job opportunities"
- User can provide multiple values (comma-separated or conversational)
- If unclear, default to "just exploring"

For arrays (skills, interests, lookingFor, focus_areas, skills_offered, opportunities_offered):
- Split by commas if user provides comma-separated values
- Return as JSON array
- Require at least 1 item
- For lookingFor specifically, map semantic variations to allowed enum values

For enums (gender, type):
- Convert to lowercase
- Check against allowed values
- Return error if not in allowed list

For booleans (is_aurovillian):
- Accept: yes/no, true/false, aurovillian/non-aurovillian
- Convert to "yes" or "no"

Return ONLY valid JSON in this exact format:
{
  "isValid": true/false,
  "extractedValue": <value or array or null>,
  "validationMessage": "<error message if invalid, empty string if valid>"
}

Examples for "looking_for":
- Input: "need to explore" → extractedValue: ["just exploring"], isValid: true
- Input: "internships and courses" → extractedValue: ["internships", "courses"], isValid: true
- Input: "want to find a job" → extractedValue: ["job opportunities"], isValid: true
- Input: "just checking things out" → extractedValue: ["just exploring"], isValid: true
`;

  const messages = [{ role: "user", content: validationPrompt }];

  const payload = {
    messages,
    max_tokens: 500,
    temperature: 0.2,
  };

  const command = new InvokeModelCommand({
    modelId: DEFAULT_MODEL,
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const decodedBody = await streamToString(response.body as any);

  let json;
  try {
    json = JSON.parse(decodedBody);
  } catch {
    console.error("Failed to parse validation response:", decodedBody);
    throw new Error("Invalid JSON from validation model");
  }

  const rawText = json?.choices?.[0]?.message?.content || "{}";

  try {
    // Clean known wrappers/tags the model may include
    let cleaned = rawText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
    cleaned = cleaned.replace(/```/g, "").trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error("No JSON found in validation result:", rawText);
      return {
        isValid: false,
        validationMessage: "Failed to validate response: no JSON found",
      };
    }

    const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
    const validationResult = JSON.parse(jsonStr);
    const isValid = !!validationResult.isValid;
    let extractedValue = validationResult.extractedValue;
    const validationMessage = validationResult.validationMessage || "";

    // Post-processing: Ensure looking_for values are valid enums
    if (isValid && expectedField === "looking_for") {
      const allowedValues = [
        "courses",
        "internships",
        "job opportunities",
        "just exploring",
      ];

      if (Array.isArray(extractedValue)) {
        // Filter out any invalid values and convert to lowercase
        extractedValue = extractedValue
          .map((v) => String(v).toLowerCase().trim())
          .filter((v) => allowedValues.includes(v));

        // If all values were filtered out, default to "just exploring"
        if (extractedValue.length === 0) {
          extractedValue = ["just exploring"];
        }
      } else if (typeof extractedValue === "string") {
        const normalized = extractedValue.toLowerCase().trim();
        extractedValue = allowedValues.includes(normalized)
          ? [normalized]
          : ["just exploring"];
      }
    }

    // Fallback: accept any non-empty location if the model rejected it
    if (!isValid && expectedField === "location") {
      const trimmed = (userInput || "").trim();
      if (trimmed.length > 0) {
        console.warn(
          `Validation model rejected location "${userInput}"; accepting fallback value.`,
        );
        return {
          isValid: true,
          extractedValue: trimmed,
          validationMessage: "",
        };
      }
    }

    return {
      isValid,
      extractedValue,
      validationMessage,
    };
  } catch (_err) {
    console.error("Failed to parse validation result:", rawText, _err);
    return {
      isValid: false,
      validationMessage: "Failed to validate response: parsing error",
    };
  }
}

// Conversation store
const MAX_MESSAGES_PER_CONVO = 50;
const conversationStore: Map<
  string,
  Array<{ role: string; content: string }>
> = new Map();

export function addToConversation(
  key: string,
  message: { role: string; content: string },
) {
  if (!key) return;
  const arr = conversationStore.get(key) || [];
  arr.push(message);
  if (arr.length > MAX_MESSAGES_PER_CONVO) {
    arr.splice(0, arr.length - MAX_MESSAGES_PER_CONVO);
  }
  conversationStore.set(key, arr);
}

export function getConversation(key: string) {
  if (!key) return [] as Array<{ role: string; content: string }>;
  return conversationStore.get(key) || [];
}

export function clearConversation(key: string) {
  if (!key) return;
  conversationStore.delete(key);
}

// Helper to get last bot message
export function getLastBotQuestion(key: string): string {
  const convo = getConversation(key);
  for (let i = convo.length - 1; i >= 0; i--) {
    if (convo[i].role === "assistant") {
      return convo[i].content;
    }
  }
  return "";
}
