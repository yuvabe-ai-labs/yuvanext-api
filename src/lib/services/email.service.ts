import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "../../routes/templates");

const templateFiles: Record<string, string> = {
  applied: path.join(templatesDir, "applied.html"),
  shortlisted: path.join(templatesDir, "shortlisted.html"),
  rejected: path.join(templatesDir, "rejected.html"),
  interviewed: path.join(templatesDir, "interviewed.html"),
  hired: path.join(templatesDir, "hired.html"),
  unitInterview: path.join(templatesDir, "unit-interview.html"),
};

const compiledTemplates: Record<string, Handlebars.TemplateDelegate> = {};

async function loadTemplates() {
  const keys = Object.keys(templateFiles);
  await Promise.all(
    keys.map(async (k) => {
      if (compiledTemplates[k]) return;
      try {
        const content = await readFile(templateFiles[k], "utf-8");
        compiledTemplates[k] = Handlebars.compile(content);
      } catch {
        // Silently handle template loading errors
      }
    }),
  );
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
    `🎉 Great News! You've been shortlisted - ${p.internshipTitle}`,
  rejected: (p: EmailParams) => `Application Update - ${p.internshipTitle}`,
  interviewed: (p: EmailParams) =>
    `📅 Interview Scheduled - ${p.internshipTitle}`,
  hired: (p: EmailParams) =>
    `🎊 Congratulations! Offer Letter - ${p.internshipTitle}`,
};

// Send application-related email
export async function sendApplicationEmail(
  status: "applied" | "shortlisted" | "rejected" | "interviewed" | "hired",
  params: EmailParams,
): Promise<boolean> {
  try {
    await loadTemplates();

    const template = compiledTemplates[status];
    const scheduledAtFormatted = formatScheduledAt(
      params.additionalData?.scheduledAt,
    );

    const html = template
      ? template({
          ...params,
          scheduledAt: scheduledAtFormatted,
          meetingLink: params.additionalData?.meetingLink,
          notes: params.additionalData?.notes,
        })
      : "";

    const subject = subjects[status](params);

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: params.to,
      subject,
      html,
    });

    console.error(`Email sent successfully: ${status} to ${params.to}`);
    return true;
  } catch (error) {
    console.error(`Failed to send ${status} email:`, error);
    return false;
  }
}

// Send interview email to unit
export async function sendUnitInterviewEmail(
  params: UnitInterviewEmailParams,
): Promise<boolean> {
  try {
    await loadTemplates();
    const template = compiledTemplates.unitInterview;
    const scheduledAtFormatted = formatScheduledAt(
      params.additionalData?.scheduledAt,
    );

    const html = template
      ? template({
          ...params,
          scheduledAt: scheduledAtFormatted,
          meetingLink: params.additionalData?.meetingLink,
          notes: params.additionalData?.notes,
        })
      : "";

    const subject = `📅 Interview Scheduled - ${params.candidateName} for ${params.internshipTitle}`;

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: params.to,
      subject,
      html,
    });

    console.error(`Unit interview email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error("Failed to send unit interview email:", error);
    return false;
  }
}

// Verify transporter configuration
export async function verifyEmailConfiguration(): Promise<boolean> {
  try {
    await transporter.verify();
    console.error("Email configuration verified successfully");
    return true;
  } catch (error) {
    console.error("Email configuration verification failed:", error);
    return false;
  }
}
