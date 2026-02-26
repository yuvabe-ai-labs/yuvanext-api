import { eq } from "drizzle-orm";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

import env from "@/config/env";
import db from "@/db";
import { user } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { mentors } from "@/db/schema/mentor.schema";
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
  metadata?: Record<string, any>,
) {
  // Update user role
  await db
    .update(user)
    .set({
      metadata: {},
      role,
    })
    .where(eq(user.id, userId));

  if (role === "candidate") {
    // Check if candidate already exists (to avoid duplicate inserts)
    const existingCandidate = await db
      .select({ userId: candidates.userId })
      .from(candidates)
      .where(eq(candidates.userId, userId))
      .limit(1);

    if (existingCandidate.length === 0) {
      // Create new candidate profile
      await db.insert(candidates).values({
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        onboardingCompleted: false,
      });
      console.log("Candidate profile created for user:", userId);
    }
  } else if (role === "mentor") {
    // Check if mentor already exists (to avoid duplicate inserts)
    const existingMentor = await db
      .select({ userId: mentors.userId })
      .from(mentors)
      .where(eq(mentors.userId, userId))
      .limit(1);

    if (existingMentor.length === 0) {
      try {
        // Create new mentor profile
        await db.insert(mentors).values({
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          onboardingCompleted: false,
        });
        console.log("Mentor profile created for user:", userId);
      } catch (err) {
        console.error("Error creating mentor profile for user:", userId, err);
        throw err;
      }
    } else {
      console.log("Mentor profile already exists for user:", userId);
    }
  } else if (role === "unit") {
    // Check if unit already exists (to avoid duplicate inserts)
    const existingUnit = await db
      .select({ userId: units.userId })
      .from(units)
      .where(eq(units.userId, userId))
      .limit(1);

    if (existingUnit.length > 0) {
      // Update existing unit with metadata if provided
      if (metadata) {
        await db
          .update(units)
          .set({
            name: metadata.companyName || undefined,
            type: metadata.companyType || undefined,
            phone: metadata.contactNumber || undefined,
            address: metadata.address || undefined,
            description: metadata.aboutCompany || undefined,
            industry: metadata.industryType || undefined,
            isAurovillian: metadata.companyType === "auroville_unit",
            skillsOffered: metadata.serviceOffered || undefined,
            projects: metadata.achievements || "",
            websiteUrl: website_url || metadata.website_url || undefined,
            updatedAt: new Date(),
          })
          .where(eq(units.userId, userId));
      }
    } else {
      // Create new unit profile
      await db.insert(units).values({
        userId,
        name: metadata?.companyName || undefined,
        type: metadata?.companyType || undefined,
        phone: metadata?.contactNumber || undefined,
        address: metadata?.address || undefined,
        description: metadata?.aboutCompany || undefined,
        industry: metadata?.industryType || undefined,
        isAurovillian: metadata?.companyType === "auroville_unit" || false,
        skillsOffered: metadata?.serviceOffered || undefined,
        projects: metadata?.achievements || "",
        websiteUrl: website_url || metadata?.website_url || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}

export async function sendInvitationEmail(
  recipient: string,
  name: string,
  invitationUrl: string,
  invitationData?: {
    companyName?: string;
    companyType?: string;
    industryType?: string;
  },
) {
  try {
    const html = await loadTemplate("invitation.html", {
      name,
      email: recipient,
      invitationUrl,
      companyName: invitationData?.companyName || "",
      companyType: invitationData?.companyType || "",
      industryType: invitationData?.industryType || "",
      showCompanyInfo: invitationData ? "true" : "",
    });

    await transporter.sendMail({
      from: env.SMTP_USER,
      to: recipient,
      subject: "Welcome to YuvaNext - Complete Your Registration",
      html,
    });

    return true;
  } catch (error) {
    console.error("Error sending invitation email:", error);
    throw error;
  }
}

// Pre-load templates on module initialization (optional but recommended)
async function preloadTemplates() {
  const templates = [
    "verify-email.html",
    "reset-password.html",
    "change-email-verification.html",
    "invitation.html",
  ];
  await Promise.allSettled(
    templates.map((template) => loadTemplate(template, {})),
  );
}
// Preload templates in the background (don't await to avoid blocking)
preloadTemplates().catch((error) => {
  console.warn("Failed to preload auth templates:", error);
});
