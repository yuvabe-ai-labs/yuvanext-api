import { eq } from "drizzle-orm";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

import env from "@/config/env";
import db from "@/db";
import { user } from "@/db/schema/auth.schema";
import { units } from "@/db/schema/unit.schema";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

// FIX: Detect if running in Lambda (compiled) or Local (source)
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const baseFolder = isLambda ? "dist" : "src";
const templatesDir = path.join(process.cwd(), baseFolder, "templates");

// Cache compiled templates
const compiledTemplates: Record<string, Handlebars.TemplateDelegate> = {};

async function loadTemplate(
  templateName: string,
  variables: Record<string, string>,
): Promise<string> {
  try {
    // Check cache first
    if (!compiledTemplates[templateName]) {
      const templatePath = path.join(templatesDir, templateName);
      const content = await readFile(templatePath, "utf-8");
      compiledTemplates[templateName] = Handlebars.compile(content);
    }

    return compiledTemplates[templateName](variables);
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    throw new Error(`Failed to load template: ${templateName}`);
  }
}

export async function sendChangeEmailConfirmation(
  currentEmail: string,
  newEmail: string,
  url: string,
  name: string,
  token: string,
) {
  try {
    const html = await loadTemplate("change-email-verification.html", {
      newEmail,
      url,
      name,
      token,
    });

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: currentEmail,
      subject: "Confirm Your Email Change",
      html,
    });

    return true;
  } catch (error) {
    console.error("Error sending change email confirmation:", error);
    throw error;
  }
}

export async function sendVerificationMail(
  recipient: string,
  username: string,
  url: string,
) {
  try {
    const html = await loadTemplate("verify-email.html", {
      name: username,
      url,
    });

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: recipient,
      subject: "Welcome to YuvaNext – Please Verify Your Account",
      html,
    });

    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export async function sendResetPasswordEmail(recipient: string, url: string) {
  try {
    const html = await loadTemplate("reset-password.html", {
      url,
    });

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: recipient,
      subject: "Reset Your Password",
      html,
    });

    return true;
  } catch (error) {
    console.error("Error sending reset password email:", error);
    throw error;
  }
}

export async function enableUserByEmailBeforeSignin(email: string) {
  const existingUser = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (!existingUser) {
    console.error("User not found:", email);
    return;
  }

  if (existingUser.accountDisabled === true) {
    console.log("Enabling user before signin:", existingUser.id);

    await db
      .update(user)
      .set({
        accountDisabled: false,
        updatedAt: new Date(),
      })
      .where(eq(user.id, existingUser.id));

    console.log("User enabled successfully"); // Fixed: was console.error
  } else {
    console.log("User was not disabled, no action needed"); // Fixed: was console.error
  }
}

export async function updateUserRoleOnEmailVerification(
  userId: string,
  role: string,
  website_url?: string,
) {
  await db
    .update(user)
    .set({
      metadata: {},
      role,
    })
    .where(eq(user.id, userId));

  if (role === "unit") {
    await db.insert(units).values({
      userId,
      websiteUrl: website_url,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// Pre-load templates on module initialization (optional but recommended)
async function preloadTemplates() {
  const templates = [
    "verify-email.html",
    "reset-password.html",
    "change-email-verification.html",
  ];

  await Promise.allSettled(
    templates.map((template) => loadTemplate(template, {})),
  );
}

// Preload templates in the background (don't await to avoid blocking)
preloadTemplates().catch((error) => {
  console.warn("Failed to preload auth templates:", error);
});
