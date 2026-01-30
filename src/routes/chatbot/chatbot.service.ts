// chatbot.service.ts - Structured output only

import type { Readable } from "node:stream";

import {
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Buffer } from "node:buffer";

import {
  bedrockClient as client,
  DEFAULT_MODEL,
} from "@/lib/services/bedrock.service";

async function streamToString(stream: Readable | Uint8Array): Promise<string> {
  if (stream instanceof Uint8Array)
    return Buffer.from(stream).toString("utf-8");

  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

// Type for structured bot response
export interface StructuredBotResponse {
  message: string;
  question?: string | null;
  options?: string[] | null;
  fieldType?: "text" | "select" | "multiselect" | null;
  isComplete?: boolean;
}

// Streaming generator with structured output
export async function* generateStructuredStreamFromModel(
  prompt: string,
  systemPrompt: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): AsyncGenerator<StructuredBotResponse, void, unknown> {
  const enhancedSystemPrompt = `${systemPrompt}

CRITICAL: You must ALWAYS respond with valid JSON in this exact format:
{
  "message": "Your conversational message here",
  "question": "The specific question you're asking (if any)",
  "options": ["Option 1", "Option 2", "Option 3"],
  "fieldType": "text" | "select" | "multiselect",
  "isComplete": false
}

Rules:
- "message": Always include a friendly conversational message
- "question": Extract ONLY the question part (e.g., "What's your phone number?" not "Great! What's your phone number?")
- "options": Include if you're presenting choices (array of strings), otherwise null
- "fieldType": 
  * "text" for open-ended questions
  * "select" for single choice questions
  * "multiselect" for multiple choice questions
- "isComplete": Set to true ONLY when saying the final completion message

Examples:

For greeting:
{
  "message": "Hi! I'm here to help you get started with YuvaNext. Let's begin with some basic details.",
  "question": "What's the best number to reach you on?",
  "options": null,
  "fieldType": "text",
  "isComplete": false
}

For multiple choice:
{
  "message": "Great! Now let me know about your education status.",
  "question": "Are you still in school?",
  "options": ["Yes, I'm still in school", "No, I've completed school"],
  "fieldType": "select",
  "isComplete": false
}

For completion:
{
  "message": "Perfect! You're all set! Let me process your profile and find the best matches for you.",
  "question": null,
  "options": null,
  "fieldType": null,
  "isComplete": true
}

IMPORTANT: Return ONLY the JSON object, no other text.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: enhancedSystemPrompt },
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

    let accumulatedText = "";

    for await (const event of response.body) {
      if (event.chunk?.bytes) {
        try {
          const chunk = JSON.parse(
            Buffer.from(event.chunk.bytes).toString("utf-8"),
          );
          const text = chunk?.choices?.[0]?.delta?.content || "";

          if (text) {
            accumulatedText += text;
          }
        } catch (parseErr) {
          console.error("Failed to parse streaming chunk:", parseErr);
        }
      }
    }

    // Parse accumulated JSON response
    const cleanedText = accumulatedText
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    try {
      const structuredResponse: StructuredBotResponse = JSON.parse(cleanedText);
      yield structuredResponse;
    } catch (jsonErr) {
      console.error("Failed to parse structured response:", cleanedText);
      // Fallback to unstructured response
      yield {
        message: accumulatedText,
        question: null,
        options: null,
        fieldType: "text",
        isComplete: false,
      };
    }
  } catch (error) {
    console.error("Streaming error:", error);
    throw error;
  }
}

// Field detection for auto-save
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

// Validation and extraction
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
    phone: "Valid phone number (10 digits, may include country code)",
    gender: "Must be one of: male, female, other, prefer not to say",
    grade: "School grade (9th, 10th, 11th, 12th, or other)",
    experience_level: "Experience level or grade",
    skills: "Comma-separated list of skills (minimum 1)",
    interests: "Comma-separated list of interests (minimum 1)",
    looking_for:
      "One or more of: courses, internships, job opportunities, just exploring, " +
      "help me discover my strengths, learn new digital skills, " +
      "find community projects or internships, meet mentors or role models",
    location: "Valid city or location name",
    name: "Valid organization or unit name (non-empty string)",
    focus_areas: "Comma-separated list of focus areas (minimum 1)",
    skills_offered: "Comma-separated list of skills offered (minimum 1)",
    is_aurovillian:
      "Must be yes/no or true/false or aurovillian/non-aurovillian",
    opportunities_offered: "Comma-separated list of opportunities (minimum 1)",
  };

  let validationRule = fieldValidationRules[expectedField] || "Valid input";

  if (expectedField === "type") {
    if (role === "candidate") {
      validationRule = "Must be one of: student, fresher, working, graduate";
    } else if (role === "unit") {
      validationRule = "Non-empty string describing unit type";
    }
  }

  const validationPrompt = `
You are a strict but intelligent data validator for a recruitment system.

Question asked: "${question}"
Expected field: "${expectedField}"
Validation rule: ${validationRule}
User's answer: "${userInput}"

Return ONLY valid JSON in this exact format:
{
  "isValid": true/false,
  "extractedValue": <value or array or null>,
  "validationMessage": "<error message if invalid, empty string if valid>"
}

Rules for "looking_for":
- Allowed values: ["courses", "internships", "job opportunities", "just exploring", "help me discover my strengths", "learn new digital skills", "find community projects or internships", "meet mentors or role models"]
- Accept semantic matches (case-insensitive):
  - "explore" → "just exploring"
  - "job" → "job opportunities"
  - "mentor"/"mentorship"/"mentors" → "meet mentors or role models"
  - "discover strengths"/"discover my strengths" → "help me discover my strengths"
  - "digital skill"/"digital skills" → "learn new digital skills"
  - "community project"/"community projects" → "find community projects or internships"
- Trim punctuation and whitespace; return normalized values as an array of strings matching the allowed values
- If no matches, set isValid=false and include a helpful validationMessage
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
    let cleaned = rawText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
    cleaned = cleaned.replace(/```/g, "").trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return {
        isValid: false,
        validationMessage: "Failed to validate response",
      };
    }

    const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
    const validationResult = JSON.parse(jsonStr);

    return {
      isValid: !!validationResult.isValid,
      extractedValue: validationResult.extractedValue,
      validationMessage: validationResult.validationMessage || "",
    };
  } catch (_err) {
    console.error("Failed to parse validation result:", rawText, _err);
    return {
      isValid: false,
      validationMessage: "Failed to validate response",
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

export function getLastBotQuestion(key: string): string {
  const convo = getConversation(key);
  for (let i = convo.length - 1; i >= 0; i--) {
    if (convo[i].role === "assistant") {
      return convo[i].content;
    }
  }
  return "";
}
