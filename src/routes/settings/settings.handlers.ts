import { eq } from "drizzle-orm";
import type { AppRouteHandler } from "@/types/app.types";
import db from "@/db";
import { user, session } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { units } from "@/db/schema/unit.schema";
import { userSettings } from "@/db/schema/settings.schema";
import {
  OK,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
} from "@/lib/openapi/http-status-codes";

import type {
  ChangePhone,
  UpdateNotifications,
  SetDisability,
  DeactivateAccount,
} from "./settings.routes";

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
      console.error("Unsupported role for phone update:", currentUser.role);
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
        accountDisabled: true,
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
