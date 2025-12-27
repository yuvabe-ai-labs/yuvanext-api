import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import crypto from "crypto";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user, account, session, verification } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { units } from "@/db/schema/unit.schema";
import { userSettings } from "@/db/schema/settings.schema";
import {
  OK,
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
} from "@/lib/openapi/http-status-codes";
import { sendVerificationMail } from "@/routes/auth/auth.services";
import env from "@/config/env";

import type {
  ChangeEmail,
  ChangePassword,
  ChangePhone,
  UpdateNotifications,
  SetDisability,
  DeactivateAccount,
  DeleteAccount,
} from "./settings.routes";

export const changeEmail: AppRouteHandler<ChangeEmail> = async (c) => {
  const currentUser = c.get("user");
  const body = c.req.valid("json");

  try {
    // Verify current password
    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.userId, currentUser.id))
      .limit(1);

    const cred =
      accounts.find((a) => a.providerId === "credentials") || accounts[0];

    if (!cred || !cred.password) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "No password credentials for this account",
        },
        BAD_REQUEST,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      body.currentPassword,
      cred.password as string,
    );

    if (!isPasswordValid) {
      return c.json(
        {
          status_code: UNAUTHORIZED,
          message: "Invalid password",
        },
        UNAUTHORIZED,
      );
    }

    // Update email and set emailVerified to false
    const updatedUser = await db
      .update(user)
      .set({
        email: body.email,
        emailVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(user.id, currentUser.id))
      .returning();

    if (updatedUser.length === 0) {
      return c.json(
        {
          status_code: INTERNAL_SERVER_ERROR,
          message: "Failed to update email",
        },
        INTERNAL_SERVER_ERROR,
      );
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: body.email,
      value: verificationToken,
      expiresAt,
    });

    // Generate verification URL - automatically from request
    const baseUrl = new URL(c.req.url).origin;
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(body.email)}`;

    // Send verification email
    try {
      await sendVerificationMail(
        body.email,
        currentUser.name || "User",
        verificationUrl,
      );
    } catch (emailErr) {
      console.error("Error sending verification email:", emailErr);
      // Don't fail the request if email sending fails
    }

    return c.json(
      {
        status_code: OK,
        message:
          "Email updated successfully. Verification email sent to your new email address.",
      },
      OK,
    );
  } catch (err) {
    console.error("Error changing email:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const changePassword: AppRouteHandler<ChangePassword> = async (c) => {
  const currentUser = c.get("user");
  const body = c.req.valid("json");

  try {
    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.userId, currentUser.id))
      .limit(1);

    const cred =
      accounts.find((a) => a.providerId === "credentials") || accounts[0];

    if (!cred || !cred.password) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "No password credentials for this account",
        },
        BAD_REQUEST,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      body.currentPassword,
      cred.password as string,
    );

    if (!isPasswordValid) {
      return c.json(
        {
          status_code: UNAUTHORIZED,
          message: "Invalid current password",
        },
        UNAUTHORIZED,
      );
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 10);

    await db
      .update(account)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(account.userId, currentUser.id));

    return c.json(
      {
        status_code: OK,
        message: "Password updated successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error changing password:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const changePhone: AppRouteHandler<ChangePhone> = async (c) => {
  const currentUser = c.get("user");
  const body = c.req.valid("json");

  try {
    if (currentUser.role === "candidate") {
      await db
        .update(candidates)
        .set({
          phone: body.phone,
          updatedAt: new Date(),
        })
        .where(eq(candidates.userId, currentUser.id));
    } else if (currentUser.role === "unit") {
      await db
        .update(units)
        .set({
          phone: body.phone,
          updatedAt: new Date(),
        })
        .where(eq(units.userId, currentUser.id));
    } else {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "Unsupported role for phone update",
        },
        FORBIDDEN,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Phone number updated successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error changing phone:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const updateNotifications: AppRouteHandler<UpdateNotifications> = async (
  c,
) => {
  const currentUser = c.get("user");
  const body = c.req.valid("json");

  try {
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, currentUser.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(userSettings).values({
        userId: currentUser.id,
        emailNotificationsEnabled: body.emailNotificationsEnabled ?? true,
        inAppNotificationsEnabled: body.inAppNotificationsEnabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      const updateData: Record<string, any> = { updatedAt: new Date() };

      if (body.emailNotificationsEnabled !== undefined) {
        updateData.emailNotificationsEnabled = body.emailNotificationsEnabled;
      }
      if (body.inAppNotificationsEnabled !== undefined) {
        updateData.inAppNotificationsEnabled = body.inAppNotificationsEnabled;
      }

      await db
        .update(userSettings)
        .set(updateData)
        .where(eq(userSettings.userId, currentUser.id));
    }

    return c.json(
      {
        status_code: OK,
        message: "Notification settings updated successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error updating notifications:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const setDisability: AppRouteHandler<SetDisability> = async (c) => {
  const currentUser = c.get("user");
  const body = c.req.valid("json");

  try {
    await db
      .update(candidates)
      .set({
        isDifferentlyAbled: body.isDifferentlyAbled,
        updatedAt: new Date(),
      })
      .where(eq(candidates.userId, currentUser.id));

    return c.json(
      {
        status_code: OK,
        message: "Disability status updated successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error setting disability:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const deactivateAccount: AppRouteHandler<DeactivateAccount> = async (
  c,
) => {
  const currentUser = c.get("user");

  try {
    await db
      .update(user)
      .set({
        banned: true,
        banReason: "user_deactivated",
        updatedAt: new Date(),
      })
      .where(eq(user.id, currentUser.id));

    // Remove active sessions
    await db.delete(session).where(eq(session.userId, currentUser.id));

    return c.json(
      {
        status_code: OK,
        message: "Account deactivated successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error deactivating account:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const deleteAccount: AppRouteHandler<DeleteAccount> = async (c) => {
  const currentUser = c.get("user");

  try {
    await db.delete(user).where(eq(user.id, currentUser.id));

    return c.json(
      {
        status_code: OK,
        message: "Account deleted successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error deleting account:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
