// config/auth.ts

import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, openAPI } from "better-auth/plugins";
import crypto from "crypto";

import {
  sendResetPasswordEmail,
  sendVerificationMail,
  updateUserRoleOnEmailVerification,
  enableUserByEmailBeforeSignin,
  sendChangeEmailConfirmation,
} from "@/routes/auth/auth.service";

import db from "../db/index";
import { ac, admin, candidate, unit } from "./auth-permission";
import { ALLOWED_ORIGINS } from "@/lib/create-app";

export const auth = betterAuth({
  appName: "Yuvanext API",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    openAPI(),
    adminPlugin({
      ac,
      adminRoles: ["admin"],
      defaultRole: "candidate",
      roles: {
        admin,
        candidate,
        unit,
      },
    }),
  ],
  // Add this hook at the top level
  hooks: {
    before: async (ctx: any) => {
      if (ctx.path === "/sign-in/email" && ctx.method === "POST") {
        const email = ctx.body?.email || ctx.request?.body?.email;
        if (email) {
          // Fire-and-forget - executes after sign-in completes
          enableUserByEmailBeforeSignin(email).catch((error) => {
            console.error("Error enabling user:", error);
          });
        }
      }
    },
  },
  trustedOrigins: ALLOWED_ORIGINS,
  user: {
    additionalFields: {
      metadata: {
        type: "json",
        required: true,
        input: true,
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url, token }) => {
        try {
          await sendChangeEmailConfirmation(
            user.email,
            newEmail,
            url,
            user.name,
            token,
          );
        } catch (error) {
          console.error(
            `Error sending change email confirmation to ${user.email}: ${error}`,
          );
          throw error;
        }
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const userWithMetadata = user as any;

      // Check if user was invited by admin - skip verification email
      if (userWithMetadata.metadata?.invitedByAdmin) {
        console.log(
          "Skipping verification email for admin-invited user:",
          user.email,
        );
        return; // Don't send email for admin invitations
      }

      // Send verification email for normal sign-ups
      try {
        await sendVerificationMail(user.email, user.name, url);
      } catch (error) {
        console.error(
          `Error sending verification link to ${user.email}: ${error}`,
        );
        throw error;
      }
    },
    onEmailVerification: async (user: Record<string, any>) => {
      if (user.metadata?.role) {
        await updateUserRoleOnEmailVerification(
          user.id,
          user.metadata.role,
          user.metadata.website_url,
          user.metadata,
        );
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 4,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendResetPasswordEmail(user.email, url);
      } catch (error) {
        console.error(
          `Error sending reset password link to ${user.email}: ${error}`,
        );
        throw error;
      }
    },
    password: {
      hash: async (password) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ password, hash }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },
  advanced: {
    database: {
      generateId: (_options) => crypto.randomUUID(),
    },
    disableOriginCheck: true,
    crossSubDomainCookies: {
      enabled: true,
    },
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true, // New browser standards will mandate this for foreign cookies
    },
  },
});
