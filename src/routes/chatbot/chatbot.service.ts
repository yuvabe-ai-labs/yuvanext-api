// chatbot.service.ts - Restructured with array-based conversation management

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

/**
 * Convert stream or Uint8Array to string
 */
async function streamToString(stream: Readable | Uint8Array): Promise<string> {
  if (stream instanceof Uint8Array)
    return Buffer.from(stream).toString("utf-8");

  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface StructuredBotResponse {
  message: string;
  question?: string | null;
  options?: string[] | null;
  fieldType?: "text" | "select" | "multiselect" | null;
  isComplete?: boolean;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface ExtractedFieldData {
  [key: string]: any;
}

interface ConversationSession {
  messages: ConversationMessage[];
  extractedData: ExtractedFieldData;
  createdAt: Date;
  lastUpdatedAt: Date;
}

// ============================================================================
// CONVERSATION STORE - In-Memory Array-Based Storage
// ============================================================================

const MAX_MESSAGES_PER_CONVO = 50;
const conversationStore: Map<string, ConversationSession> = new Map();

/**
 * Initialize a new conversation session.
 * FIX: Always resets extractedData when called, so stale data from a previous
 * incomplete session never bleeds into a new one.
 */
export function initializeConversation(userId: string): void {
  if (!conversationStore.has(userId)) {
    conversationStore.set(userId, {
      messages: [],
      extractedData: {},
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    });
    console.log(`[Conversation Initialized] userId: ${userId}`);
  }
}

/**
 * Force-reset conversation session (use on new onboarding start).
 */
export function resetConversation(userId: string): void {
  conversationStore.set(userId, {
    messages: [],
    extractedData: {},
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
  });
  console.log(`[Conversation Reset] userId: ${userId}`);
}

/**
 * Add a message to conversation history
 */
export function addMessage(
  userId: string,
  role: "user" | "assistant" | "system",
  content: string,
): void {
  if (!userId) return;

  const session = conversationStore.get(userId);
  if (!session) {
    initializeConversation(userId);
    return addMessage(userId, role, content);
  }

  const message: ConversationMessage = {
    role,
    content,
    timestamp: new Date(),
  };

  session.messages.push(message);
  session.lastUpdatedAt = new Date();

  if (session.messages.length > MAX_MESSAGES_PER_CONVO) {
    session.messages.splice(
      0,
      session.messages.length - MAX_MESSAGES_PER_CONVO,
    );
  }

  conversationStore.set(userId, session);
}

/**
 * Get conversation messages
 */
export function getMessages(userId: string): ConversationMessage[] {
  if (!userId) return [];
  const session = conversationStore.get(userId);
  return session ? session.messages : [];
}

/**
 * Add extracted field data to session (does NOT save to DB yet)
 */
export function addExtractedField(
  userId: string,
  field: string,
  value: any,
): void {
  if (!userId) return;

  const session = conversationStore.get(userId);
  if (!session) {
    initializeConversation(userId);
    return addExtractedField(userId, field, value);
  }

  session.extractedData[field] = value;
  session.lastUpdatedAt = new Date();

  conversationStore.set(userId, session);
  console.log(`[Field Extracted] userId: ${userId}, field: ${field}`);
}

/**
 * Get all extracted data for a user
 */
export function getExtractedData(userId: string): ExtractedFieldData {
  if (!userId) return {};
  const session = conversationStore.get(userId);
  return session ? { ...session.extractedData } : {};
}

/**
 * Get the last question asked by the bot
 */
export function getLastBotQuestion(userId: string): string {
  const messages = getMessages(userId);

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      return messages[i].content;
    }
  }

  return "";
}

/**
 * Clear conversation and extracted data for a user
 */
export function clearConversation(userId: string): void {
  if (!userId) return;
  conversationStore.delete(userId);
  console.log(`[Conversation Cleared] userId: ${userId}`);
}

export function getConversationSession(
  userId: string,
): ConversationSession | null {
  return conversationStore.get(userId) || null;
}

export function printConversation(userId: string): void {
  const session = conversationStore.get(userId);

  console.log("\n" + "=".repeat(80));
  console.log(`CONVERSATION SESSION (${userId})`);
  console.log("=".repeat(80));

  if (!session) {
    console.log("No conversation session found.");
    console.log("=".repeat(80) + "\n");
    return;
  }

  console.log(`Created: ${session.createdAt.toISOString()}`);
  console.log(`Last Updated: ${session.lastUpdatedAt.toISOString()}`);
  console.log(`Total Messages: ${session.messages.length}`);
  console.log(`Extracted Fields: ${Object.keys(session.extractedData).length}`);
  console.log("-".repeat(80));

  if (session.messages.length === 0) {
    console.log("No messages in conversation.");
  } else {
    session.messages.forEach((msg, index) => {
      console.log(
        `\n[${index + 1}] ${msg.role.toUpperCase()} - ${msg.timestamp?.toISOString() || "N/A"}`,
      );
      console.log("-".repeat(80));
      console.log(msg.content);
    });
  }

  if (Object.keys(session.extractedData).length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("EXTRACTED DATA:");
    console.log("-".repeat(80));
    console.log(JSON.stringify(session.extractedData, null, 2));
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

// ============================================================================
// AI MODEL FUNCTIONS
// ============================================================================

export async function* generateStructuredStreamFromModel(
  conversationHistory: ConversationMessage[],
  systemPrompt: string,
): AsyncGenerator<StructuredBotResponse, void, unknown> {
  const askedQuestions: string[] = [];

  for (const msg of conversationHistory) {
    if (msg.role === "assistant") {
      const questions = msg.content.match(/[^.!?]*\?/g);
      if (questions) {
        askedQuestions.push(...questions.map((q) => q.trim()));
      }
    }
  }

  const questionHistory =
    askedQuestions.length > 0
      ? `\n\nIMPORTANT - Questions already asked in this conversation:\n${askedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nDO NOT repeat any of these questions. Move to the NEXT question in the sequence.\n`
      : "";

  const enhancedSystemPrompt = `${systemPrompt}
${questionHistory}
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

  for (const msg of conversationHistory) {
    if (msg.role !== "system") {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

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
          console.error("[Chunk Parse Error]", parseErr);
        }
      }
    }

    const cleanedText = accumulatedText
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    try {
      const structuredResponse: StructuredBotResponse = JSON.parse(cleanedText);
      yield structuredResponse;
    } catch (jsonErr) {
      console.error("[JSON Parse Error] Raw text:", cleanedText);

      yield {
        message: accumulatedText,
        question: null,
        options: null,
        fieldType: "text",
        isComplete: false,
      };
    }
  } catch (error) {
    console.error("[Streaming Error]", error);
    throw error;
  }
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalize dashes and whitespace in a string value.
 * Converts en dash / em dash → hyphen, non-breaking spaces → regular spaces.
 */
function normalizeDashes(value: string): string {
  return value
    .replace(/\u2013|\u2014|–|—/g, "-")
    .replace(/\u202F|\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * availability_time_windows: no validation, accept any non-empty value.
 * The LLM detector already extracts this reasonably; validation only causes
 * false negatives due to format variations.
 */
function validateTimeWindows(userInput: any): {
  isValid: boolean;
  extractedValue?: any;
  validationMessage: string;
} {
  const isEmpty =
    userInput === null ||
    userInput === undefined ||
    (typeof userInput === "string" && userInput.trim() === "") ||
    (Array.isArray(userInput) && userInput.length === 0);

  if (isEmpty) {
    return {
      isValid: false,
      validationMessage:
        "Please provide at least one time window (e.g. '9 AM - 12 PM').",
    };
  }

  // Safely convert any value to a clean string — prevents [object Object] being stored.
  // Objects/arrays from the LLM detector are serialized to JSON; plain strings are dash-normalized.
  let stored: string;
  if (typeof userInput === "string") {
    stored = normalizeDashes(userInput);
  } else if (Array.isArray(userInput)) {
    // e.g. ["9 AM - 12 PM", "3 PM - 6 PM"] → "9 AM - 12 PM, 3 PM - 6 PM"
    stored = userInput
      .map((v) =>
        typeof v === "string" ? normalizeDashes(v) : JSON.stringify(v),
      )
      .join(", ");
  } else {
    // Object like { start: "9 AM", end: "12 PM" } → store as JSON string
    stored = JSON.stringify(userInput);
  }

  return { isValid: true, extractedValue: stored, validationMessage: "" };
}

/**
 * Deterministically validate mentoring_capacity.
 * Accepts both hyphen and en-dash variants.
 */
function validateMentoringCapacity(userInput: string): {
  isValid: boolean;
  extractedValue?: string;
  validationMessage: string;
} {
  const normalized = normalizeDashes(userInput).toLowerCase().trim();
  const allowed = ["1-2", "3-5", "6-10", "10+"];

  if (allowed.includes(normalized)) {
    return { isValid: true, extractedValue: normalized, validationMessage: "" };
  }

  return {
    isValid: false,
    validationMessage:
      "Please select a valid mentoring capacity: 1-2, 3-5, 6-10, or 10+.",
  };
}

/**
 * Pre-process a user's raw input before it reaches the LLM validator.
 * Handles known edge cases per field so the LLM sees clean input.
 */
function preprocessFieldValue(field: string, value: string): string {
  switch (field) {
    case "availability_time_windows":
      return normalizeDashes(value);
    case "mentoring_capacity":
      return normalizeDashes(value);
    default:
      return value;
  }
}

// ============================================================================
// FIELD DETECTION & VALIDATION
// ============================================================================

export async function detectAndExtractFields(
  userMessage: string,
  lastBotQuestion: string,
  conversationHistory: ConversationMessage[],
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

  const mentorFields = `
- mentor_type: Type of mentor (Career Guidance Mentor, Internship Application Support Mentor, Skills & Portfolio Mentor, Wellbeing & Confidence Mentor, General Mentor)
- expertise_areas: Areas of expertise (array of strings)
- experience_snapshot: Background and experience description (text) — mentoring experience is optional
- availability_days: Available days of week (array of strings)
- availability_time_windows: Available time windows as a plain string (e.g. "9 AM - 12 PM, 3 PM - 6 PM")
- timezone: Timezone (UTC, IST, etc.)
- mentoring_capacity: How many mentees can support (1-2, 3-5, 6-10, 10+)
- preferred_stages: Preferred mentorship stages (array of strings)
- communication_modes: How they prefer to communicate (array of strings)
- confirm_boundaries: Confirm boundaries agreement (yes/no)`;

  let fieldsDefinition = candidateFields;
  if (role === "unit") {
    fieldsDefinition = unitFields;
  } else if (role === "mentor") {
    fieldsDefinition = mentorFields;
  }

  const historyText = conversationHistory
    .filter((msg) => msg.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const detectionPrompt = `
You are an intelligent field extractor for a recruitment chatbot.

Conversation History:
${historyText}

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

  try {
    const response = await client.send(command);
    const decodedBody = await streamToString(response.body as any);

    let json;
    try {
      json = JSON.parse(decodedBody);
    } catch {
      console.error("[Detection Response Parse Error]", decodedBody);
      return { fieldsDetected: [] };
    }

    const rawText = json?.choices?.[0]?.message?.content || "{}";

    try {
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
    } catch (err) {
      console.error("[Field Detection Parse Error]", rawText);
      return { fieldsDetected: [] };
    }
  } catch (error) {
    console.error("[Field Detection Error]", error);
    return { fieldsDetected: [] };
  }
}

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
  // FIX: Handle these fields deterministically — avoids LLM false negatives
  if (expectedField === "availability_time_windows") {
    return validateTimeWindows(userInput);
  }
  if (expectedField === "mentoring_capacity") {
    return validateMentoringCapacity(userInput);
  }

  // Pre-process input before sending to LLM validator
  const normalizedInput = preprocessFieldValue(
    expectedField,
    typeof userInput === "string" ? userInput : JSON.stringify(userInput),
  );

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
    mentor_type:
      "Must be one of: Career Guidance Mentor, Internship Application Support Mentor, Skills & Portfolio Mentor, Wellbeing & Confidence Mentor, General Mentor",
    expertise_areas: "Comma-separated list of expertise areas (minimum 1)",
    // FIX: Removed "mentoring experience required" — it is optional
    experience_snapshot:
      "Non-empty text description of professional background. Mentoring experience is optional.",
    availability_days:
      "Comma-separated list of days (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)",
    // availability_time_windows is validated deterministically (no LLM)
    availability_time_windows: "Not used — handled before reaching this point.",
    timezone: "Timezone code (UTC, IST, EST, PST, etc.)",
    // FIX: Accept both hyphen and en-dash forms
    mentoring_capacity:
      "Must be one of: 1-2, 3-5, 6-10, 10+ (hyphens or en-dashes are both valid). " +
      "Normalize to use a regular hyphen in extractedValue.",
    preferred_stages: "Comma-separated list of mentorship stages",
    communication_modes:
      "Comma-separated list of communication modes (In-person Meetings, Virtual Video Calls, Messaging, etc.)",
    // FIX: Explicitly instruct to return boolean true for any agreement
    confirm_boundaries:
      "Any expression of agreement (e.g. 'I agree', 'yes', 'ok', 'sure', 'agreed') " +
      "must be treated as valid. Return extractedValue as true (boolean). " +
      "Only return isValid=false if user explicitly disagrees or refuses.",
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
User's answer: "${normalizedInput}"

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

Rules for "confirm_boundaries":
- Any form of agreement must return: { "isValid": true, "extractedValue": true, "validationMessage": "" }
- Only return isValid=false if the user explicitly refuses or disagrees

Rules for "mentoring_capacity":
- Accept both hyphen (-) and en-dash (–) as separators
- Normalize extractedValue to use a regular hyphen: "1-2", "3-5", "6-10", "10+"
- If the input is "1-2" or "1–2", return extractedValue as "1-2"

Rules for "experience_snapshot":
- Any non-empty description of professional background is valid
- Mentoring experience is NOT required
- Return isValid=false only if the input is empty or completely unrelated gibberish
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

  try {
    const response = await client.send(command);
    const decodedBody = await streamToString(response.body as any);

    let json;
    try {
      json = JSON.parse(decodedBody);
    } catch {
      console.error("[Validation Response Parse Error]", decodedBody);
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
    } catch (err) {
      console.error("[Validation Result Parse Error]", rawText);
      return {
        isValid: false,
        validationMessage: "Failed to validate response",
      };
    }
  } catch (error) {
    console.error("[Validation Error]", error);
    return {
      isValid: false,
      validationMessage: "Failed to validate response",
    };
  }
}
