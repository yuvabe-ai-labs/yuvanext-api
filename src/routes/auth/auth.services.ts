import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

import env from "@/config/env";
import db from "@/db";
import { user } from "@/db/schema/auth.schema";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

function loadTemplate(templateName: string, variables: Record<string, string>) {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "templates",
    templateName,
  );

  let html = fs.readFileSync(templatePath, "utf-8");

  Object.keys(variables).forEach((key) => {
    html = html.replace(new RegExp(`{{${key}}}`, "g"), variables[key]);
  });

  return html;
}

export async function sendVerificationMail(
  recipient: string,
  username: string,
  url: string,
) {
  const html = loadTemplate("verify-email.html", {
    name: username,
    url,
  });

  return transporter.sendMail({
    from: env.SMTP_USER,
    to: recipient,
    subject: "Welcome to YuvaNext — Please Verify Your Account",
    html,
  });
}

export async function sendResetPasswordEmail(recipient: string, url: string) {
  const html = loadTemplate("reset-password.html", {
    url,
  });

  return transporter.sendMail({
    from: env.SMTP_USER,
    to: recipient,
    subject: "Reset Your Password",
    html,
  });
}

export async function updateUserRoleOnEmailVerification(
  userId: string,
  role: string,
) {
  await db
    .update(user)
    .set({
      metadata: {},
      role,
    })
    .where(eq(user.id, userId));
}
