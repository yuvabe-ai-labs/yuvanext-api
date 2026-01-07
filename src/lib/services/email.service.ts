import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

import env from "@/config/env";

interface EmailParams {
  to: string;
  candidateName: string;
  internshipTitle: string;
  unitName: string;
  additionalData?: {
    meetingLink?: string;
    scheduledAt?: string;
    notes?: string;
  };
}

interface UnitInterviewEmailParams {
  to: string;
  unitName: string;
  candidateName: string;
  candidateEmail: string;
  internshipTitle: string;
  additionalData?: {
    meetingLink?: string;
    scheduledAt?: string;
    notes?: string;
  };
}

interface UnitApplicationNotificationParams {
  to: string;
  unitName: string;
  candidateName: string;
  candidateEmail: string;
  internshipTitle: string;
}

interface ChangeEmailVerificationParams {
  to: string;
  name: string;
  newEmail: string;
  verificationUrl: string;
}

// Create transporter using the same config as auth service
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

// Resolve templates directory
// FIX: Detect if running in Lambda (compiled) or Local (source)
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const baseFolder = isLambda ? "dist" : "src";
const templatesDir = path.join(process.cwd(), baseFolder, "templates");

console.log("Templates directory:", templatesDir);

const templateFiles: Record<string, string> = {
  applied: path.join(templatesDir, "applied.html"),
  shortlisted: path.join(templatesDir, "shortlisted.html"),
  rejected: path.join(templatesDir, "rejected.html"),
  interviewed: path.join(templatesDir, "interviewed.html"),
  hired: path.join(templatesDir, "hired.html"),
  unitInterview: path.join(templatesDir, "unit-interview.html"),
  appliedNotification: path.join(templatesDir, "applied-unit.html"),
  changeEmailVerification: path.join(
    templatesDir,
    "change-email-verification.html",
  ),
};

const compiledTemplates: Record<string, Handlebars.TemplateDelegate> = {};
let templatesLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadTemplates() {
  // If already loaded, return immediately
  if (templatesLoaded) return;

  // If currently loading, wait for that to complete
  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  // Start loading
  loadingPromise = (async () => {
    const keys = Object.keys(templateFiles);
    const results = await Promise.allSettled(
      keys.map(async (k) => {
        const filePath = templateFiles[k];
        try {
          const content = await readFile(filePath, "utf-8");
          compiledTemplates[k] = Handlebars.compile(content);
        } catch (err) {
          // Rethrow with path for better debugging
          throw new Error(`Error loading ${k} at ${filePath}: ${err}`);
        }
      }),
    );

    // Check for failures
    const failures = results
      .map((result, index) => ({ result, key: keys[index] }))
      .filter(({ result }) => result.status === "rejected");

    if (failures.length > 0) {
      console.error("Failed to load templates:");
      failures.forEach(({ key, result }) => {
        if (result.status === "rejected") {
          console.error(`  - ${key}: ${result.reason}`);
        }
      });
      throw new Error(
        `Failed to load ${failures.length} template(s): ${failures.map((f) => f.key).join(", ")}`,
      );
    }

    templatesLoaded = true;
  })();

  await loadingPromise;
}

function formatScheduledAt(iso?: string) {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// Subject generators (keep subjects in code)
const subjects = {
  applied: (p: EmailParams) => `Application Received - ${p.internshipTitle}`,
  shortlisted: (p: EmailParams) =>
    `Great News! You've been shortlisted - ${p.internshipTitle}`,
  not_shortlisted: (p: EmailParams) =>
    `Application Update - ${p.internshipTitle}`,
  interviewed: (p: EmailParams) => `Interview Scheduled - ${p.internshipTitle}`,
  hired: (p: EmailParams) =>
    `Congratulations! Offer Letter - ${p.internshipTitle}`,
};

// Send application-related email
export async function sendApplicationEmail(
  status:
    | "applied"
    | "shortlisted"
    | "not_shortlisted"
    | "interviewed"
    | "hired",
  params: EmailParams,
): Promise<boolean> {
  try {
    // Ensure templates are loaded
    await loadTemplates();

    const template = compiledTemplates[status];

    if (!template) {
      const availableTemplates = Object.keys(compiledTemplates).join(", ");
      const errorMsg = `Template not found for status: ${status}. Available templates: ${availableTemplates || "NONE"}`;
      console.warn(errorMsg);
      throw new Error(errorMsg);
    }

    const scheduledAtFormatted = formatScheduledAt(
      params.additionalData?.scheduledAt,
    );

    const html = template({
      ...params,
      scheduledAt: scheduledAtFormatted,
      meetingLink: params.additionalData?.meetingLink,
      notes: params.additionalData?.notes,
    });

    const subject = subjects[status](params);

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: params.to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error(`Error sending application email (${status}):`, error);
    return false;
  }
}

// NEW: Send application notification email to unit (when candidate applies)
export async function sendUnitApplicationNotification(
  params: UnitApplicationNotificationParams,
): Promise<boolean> {
  try {
    await loadTemplates();
    const template = compiledTemplates.appliedNotification;

    if (!template) {
      throw new Error("Applied notification template not found");
    }

    const html = template(params);

    const subject = `New Application - ${params.candidateName} applied for ${params.internshipTitle}`;

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: params.to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error("Error sending unit application notification:", error);
    return false;
  }
}

// Send interview email to unit (when interview is scheduled)
export async function sendUnitInterviewEmail(
  params: UnitInterviewEmailParams,
): Promise<boolean> {
  try {
    await loadTemplates();
    const template = compiledTemplates.unitInterview;

    if (!template) {
      throw new Error("Unit interview template not found");
    }

    const scheduledAtFormatted = formatScheduledAt(
      params.additionalData?.scheduledAt,
    );

    const html = template({
      ...params,
      scheduledAt: scheduledAtFormatted,
      meetingLink: params.additionalData?.meetingLink,
      notes: params.additionalData?.notes,
    });

    const subject = `Interview Scheduled - ${params.candidateName} for ${params.internshipTitle}`;

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: params.to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error("Error sending unit interview email:", error);
    return false;
  }
}

// NEW: Send email change verification
export async function sendChangeEmailVerification(
  params: ChangeEmailVerificationParams,
): Promise<boolean> {
  try {
    await loadTemplates();
    const template = compiledTemplates.changeEmailVerification;

    if (!template) {
      throw new Error("Change email verification template not found");
    }

    const html = template(params);

    const subject = "Verify Your New Email Address - YuvaNext";

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: params.to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error("Error sending change email verification:", error);
    return false;
  }
}

// Verify transporter configuration
export async function verifyEmailConfiguration(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

loadTemplates().catch(() => {});
