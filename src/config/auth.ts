import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, openAPI } from "better-auth/plugins";
import crypto from "crypto";

import {
  sendResetPasswordEmail,
  sendVerificationMail,
  updateUserRoleOnEmailVerification,
} from "@/routes/auth/auth.services";

import db from "../db/index";
import { ac, admin, candidate, unit } from "./auth-permission";

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
  trustedOrigins: ["*"],
  user: {
    additionalFields: {
      metadata: {
        type: "json",
        required: true,
        input: true,
      },
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
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
        await updateUserRoleOnEmailVerification(user.id, user.metadata.role);
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
  },
});
