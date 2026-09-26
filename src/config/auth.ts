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
  enableUserByIdBeforeSignin,
  sendChangeEmailConfirmation,
} from "@/routes/auth/auth.service";

import env from "./env";
import db from "../db/index";
import { ac, admin, candidate, mentor, unit } from "./auth-permission";
import { ALLOWED_ORIGINS } from "@/lib/create-app";
import { BetterAuthUser } from "@/types/app.types";

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
        mentor,
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
  databaseHooks: {
    session: {
      create: {
        // Email sign-in clears accountDisabled through hooks.before above.
        // Social sign-in never hits /sign-in/email, so mirror it here — scoped
        // to the OAuth callback so no existing sign-in path changes behaviour.
        before: async (session: any, ctx: any) => {
          const path: string | undefined = ctx?.path;
          if (!path?.startsWith("/callback/")) return;

          try {
            await enableUserByIdBeforeSignin(session.userId);
          } catch (error) {
            console.error("Error enabling user on social signin:", error);
          }
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Signing in must not silently create an account. The signup pages opt
      // in by sending requestSignUp: true; the signin pages don't, so an
      // unknown Google account is turned away instead of being registered.
      disableImplicitSignUp: true,
      // Google sends no metadata and the column is NOT NULL. This keeps signup
      // working even against a database where migration 0030 hasn't run.
      mapProfileToUser: (profile: Record<string, any>) => ({
        name: profile.name,
        // DO NOT REMOVE THIS LINE. We deliberately do not take the Google
        // profile picture. The provider builds the user as
        // `{ ...defaults, image: profile.picture, ...thisObject }`, so this key
        // must be present to override it. Deleting it — or "tidying" it as a
        // no-op — silently restores the Google avatar. `undefined` rather than
        // `null` because a null literal here breaks Better Auth's inference of
        // the role/metadata additional fields.
        image: undefined,
        metadata: {},
      }),
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // Google verifies ownership of the address, so linking by email is safe.
      trustedProviders: ["google"],
      // Never attach a Google account under a different address.
      allowDifferentEmails: false,
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
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: BetterAuthUser;
      url: string;
    }) => {
      // Check if user was invited by admin - skip verification email
      if (user.metadata?.invitedByAdmin) {
        return;
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
    onEmailVerification: async (user: BetterAuthUser) => {
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
