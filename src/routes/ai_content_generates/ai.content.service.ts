import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

import env from "@/config/env";
import type { ContentSection, GeneratedContent } from "./ai.content.schema";

const AWS_REGION = env.AWS_REGION;
const DEFAULT_MODEL = env.BEDROCK_MODEL_ID;

const maybeCredentials =
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const client = new BedrockRuntimeClient({
  region: AWS_REGION,
  ...(maybeCredentials ? { credentials: maybeCredentials } : {}),
});

interface BedrockResponse {
  content: Array<{
    text?: string;
  }>;
}

/**
 * Build the prompt for content generation
 */
function buildPrompt(title: string, sections: ContentSection[]): string {
  const sectionDescriptions: Record<ContentSection, string> = {
    about:
      "A compelling 2-3 paragraph description of the internship, what the role entails, and what makes it exciting",
    key_responsibilities:
      "5-7 specific responsibilities and duties the intern will handle",
    what_you_will_get:
      "5-7 benefits, learning opportunities, perks, and growth aspects the intern will receive",
    skills_required:
      "5-8 technical and soft skills required or preferred for the role",
  };

  const requestedSections = sections
    .map((s) => `- ${s}: ${sectionDescriptions[s]}`)
    .join("\n");

  return `You are an expert HR professional and internship coordinator. Generate professional, engaging, and realistic content for an internship posting.

Internship Title: "${title}"

Generate the following sections:
${requestedSections}

IMPORTANT: Return ONLY a valid JSON object with no additional text, markdown, or explanation. Use these exact keys:
${sections.includes("about") ? '- "about": string (2-3 paragraphs)' : ""}
${sections.includes("key_responsibilities") ? '- "key_responsibilities": array of strings' : ""}
${sections.includes("what_you_will_get") ? '- "what_you_will_get": array of strings' : ""}
${sections.includes("skills_required") ? '- "skills_required": array of strings' : ""}

Guidelines:
- Be specific and realistic for the role level (internship)
- Use professional but engaging language
- Focus on learning and growth opportunities
- Make responsibilities actionable and clear
- Include both technical and soft skills where relevant
- Keep each array item concise (1-2 sentences max)

Return ONLY the JSON object, no other text.`;
}

/**
 * Parse AI response and extract content
 */
function parseAIResponse(
  text: string,
  requestedSections: ContentSection[],
): GeneratedContent | null {
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanedText = text.trim();

    // Remove markdown JSON code blocks
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    // Find JSON object in the text (in case there's extra text before/after)
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanedText) as GeneratedContent;

    // Validate that requested sections are present
    const result: GeneratedContent = {};

    if (requestedSections.includes("about") && parsed.about) {
      result.about = parsed.about;
    }

    if (
      requestedSections.includes("key_responsibilities") &&
      parsed.key_responsibilities
    ) {
      result.key_responsibilities = parsed.key_responsibilities;
    }

    if (
      requestedSections.includes("what_you_will_get") &&
      parsed.what_you_will_get
    ) {
      result.what_you_will_get = parsed.what_you_will_get;
    }

    if (
      requestedSections.includes("skills_required") &&
      parsed.skills_required
    ) {
      result.skills_required = parsed.skills_required;
    }

    return result;
  } catch (err) {
    console.error("Error parsing AI response:", err);
    console.error("Raw response:", text);
    return null;
  }
}

/**
 * Generate internship content using AWS Bedrock AI with OpenAI GPT model
 */
export async function generateInternshipContent(
  title: string,
  sections: ContentSection[],
): Promise<GeneratedContent | null> {
  try {
    const prompt = buildPrompt(title, sections);

    // OpenAI GPT format only
    const payload = {
      messages: [
        {
          role: "system",
          content:
            "You are an expert HR professional and internship coordinator. Generate professional, engaging content for internship postings. Always respond with valid JSON only, no additional text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    };

    const command = new InvokeModelCommand({
      modelId: DEFAULT_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);

    if (!response.body) {
      console.error("No response body from Bedrock");
      return null;
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Handle OpenAI response format
    let generatedText: string | undefined;

    if (responseBody.choices && Array.isArray(responseBody.choices)) {
      generatedText = responseBody.choices[0]?.message?.content;
    }

    if (!generatedText) {
      console.error("No content generated from AI");
      console.error("Response body structure:", Object.keys(responseBody));
      return null;
    }

    // Parse the JSON response from AI
    const parsedContent = parseAIResponse(generatedText, sections);
    return parsedContent;
  } catch (err) {
    console.error("Error generating content with Bedrock:", err);
    if (err instanceof Error) {
      console.error("Error details:", err.message);
    }
    return null;
  }
}

export async function enhanceProfileDescription(
  description: string,
): Promise<string | null> {
  try {
    const prompt = description;

    // OpenAI GPT format only
    const payload = {
      messages: [
        {
          role: "system",
          content:
            "You are a senior career counselor and expert professional profile writer. Your task is to rewrite and enhance candidate profile descriptions to be clear, concise, professional, and impact-driven. Improve tone, clarity, and structure while preserving the original meaning and factual accuracy. Highlight strengths, skills, and achievements in a confident, modern professional style. Return only the enhanced profile description text, without explanations, formatting notes, or additional commentary.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    };

    const command = new InvokeModelCommand({
      modelId: DEFAULT_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);

    if (!response.body) {
      console.error("No response body from Bedrock");
      return null;
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Handle OpenAI response format
    let enhancedText: string | undefined;

    if (responseBody.choices && Array.isArray(responseBody.choices)) {
      enhancedText = responseBody.choices[0]?.message?.content;
    }

    if (!enhancedText) {
      console.error("No content generated from AI");
      console.error("Response body structure:", Object.keys(responseBody));
      return null;
    }

    // Clean up the response
    const cleaned = cleanEnhancedText(enhancedText);
    return cleaned;
  } catch (err) {
    console.error("Error enhancing profile description:", err);
    if (err instanceof Error) {
      console.error("Error details:", err.message);
    }
    return null;
  }
}

/**
 * Clean up the enhanced text
 */
function cleanEnhancedText(text: string): string {
  let cleaned = text.trim();

  // Remove reasoning tags (OpenAI GPT may include these)
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");

  // Remove any other XML-style tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Remove common prefixes that AI might add
  const prefixPatterns = [
    /^Here's the enhanced version:?\s*/i,
    /^Enhanced (?:Description|Profile|Version):?\s*/i,
    /^Here is the (?:enhanced|improved) (?:description|profile|version):?\s*/i,
    /^(?:Enhanced|Improved|Revised)\s*:?\s*/i,
  ];

  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Remove markdown formatting if present
  cleaned = cleaned.replace(/^```.*\n?/gm, "").replace(/```$/g, "");

  // Remove quotes if the entire text is wrapped in quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned.trim();
}
