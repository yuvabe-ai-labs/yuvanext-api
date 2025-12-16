import { eq } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { units } from "@/db/schema/unit.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";

import type { GetProfile, UpdateProfile } from "./profile.routes";

import { UpdateProfileSchema } from "./profile.schema";

// GET /profile - Get user profile
export const getProfile: AppRouteHandler<GetProfile> = async (c) => {
  const user = c.get("user");

  try {
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1);

    if (!userData || userData.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "User not found" },
        NOT_FOUND,
      );
    }

    const foundUser = userData[0];

    // Fetch role-specific profile data
    let profileData = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      image: foundUser.image,
      role: foundUser.role,
      createdAt: foundUser.createdAt,
      updatedAt: foundUser.updatedAt,
    };

    if (foundUser.role === "candidate") {
      const candidateData = await db
        .select()
        .from(candidates)
        .where(eq(candidates.userId, user.id))
        .limit(1);

      if (candidateData.length > 0) {
        profileData = {
          ...profileData,
          ...candidateData[0],
        } as typeof profileData & (typeof candidateData)[0];
      }
    } else if (foundUser.role === "unit") {
      const unitData = await db
        .select()
        .from(units)
        .where(eq(units.userId, user.id))
        .limit(1);

      if (unitData.length > 0) {
        profileData = {
          ...profileData,
          ...unitData[0],
        } as typeof profileData & (typeof unitData)[0];
      }
    }

    return c.json(
      {
        status_code: OK,
        message: "Profile retrieved successfully",
        data: profileData,
      },
      OK,
    );
  } catch (_err) {
    console.error("Error fetching profile:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// PUT /profile - Update profile
export const updateProfile: AppRouteHandler<UpdateProfile> = async (c) => {
  const user = c.get("user");

  try {
    const json = await c.req.json().catch(() => ({}));
    const parsed = UpdateProfileSchema.safeParse(json);

    if (!parsed.success) {
      return c.json(
        {
          status_code: UNPROCESSABLE_ENTITY,
          message: "Validation Error",
          error: parsed.error.issues,
        },
        UNPROCESSABLE_ENTITY,
      );
    }

    const data = parsed.data;

    // Prepare updates for user and role-specific tables
    const userUpdates: Partial<typeof userTable.$inferInsert> = {};
    const candidateUpdates: Partial<typeof candidates.$inferInsert> = {};
    const unitUpdates: Partial<typeof units.$inferInsert> = {};

    // Map common user fields
    if (data.name !== undefined) userUpdates.name = data.name;
    if (data.image !== undefined) userUpdates.image = data.image;

    // Map candidate fields (only if present)
    const candidateFields = [
      "type",
      "experienceLevel",
      "profileSummary",
      "location",
      "maritalStatus",
      "isDifferentlyAbled",
      "hasCareerBreak",
      "skills",
      "interests",
      "lookingFor",
      "avatarUrl",
      "phone",
      "gender",
      "dateOfBirth",
      "onboardingCompleted",
      "education",
      "language",
      "course",
      "internship",
      "projects",
      "socialLinks",
    ] as const;

    for (const key of candidateFields) {
      if (data[key] !== undefined) {
        // Special handling: convert date strings to Date for dateOfBirth
        if (key === "dateOfBirth") {
          try {
            candidateUpdates.dateOfBirth = new Date(data[key] as string);
          } catch {
            candidateUpdates.dateOfBirth = data[key] as unknown as Date;
          }
        } else {
          (candidateUpdates as Record<string, unknown>)[key] = data[key];
        }
      }
    }

    // Map unit fields into unitUpdates so we can apply them when role === 'unit'
    const unitFields = [
      "name",
      "type",
      "phone",
      "address",
      "location",
      "onboardingCompleted",
      "websiteUrl",
      "mission",
      "values",
      "description",
      "industry",
      "isAurovillian",
      "bannerUrl",
      "avatarUrl",
      "galleryImages",
      "galleryVideos",
      "focusAreas",
      "skillsOffered",
      "opportunitiesOffered",
      "projects",
      "socialLinks",
    ] as const;

    for (const key of unitFields) {
      if (data[key] !== undefined) {
        (unitUpdates as Record<string, unknown>)[key] = data[key];
      }
    }

    // Always set updatedAt on target tables if any updates
    const now = new Date();

    // Execute updates based on role
    if (user.role === "candidate") {
      if (Object.keys(candidateUpdates).length > 0) {
        await db
          .update(candidates)
          .set({ ...candidateUpdates, updatedAt: now })
          .where(eq(candidates.userId, user.id));
      }

      if (Object.keys(userUpdates).length > 0) {
        await db
          .update(userTable)
          .set({ ...userUpdates, updatedAt: now })
          .where(eq(userTable.id, user.id));
      }
    } else if (user.role === "unit") {
      // For unit role, apply collected unitUpdates
      if (data.profileSummary !== undefined)
        unitUpdates.description = data.profileSummary;

      if (Object.keys(unitUpdates).length > 0) {
        await db
          .update(units)
          .set({ ...unitUpdates, updatedAt: now })
          .where(eq(units.userId, user.id));
      }

      if (Object.keys(userUpdates).length > 0) {
        await db
          .update(userTable)
          .set({ ...userUpdates, updatedAt: now })
          .where(eq(userTable.id, user.id));
      }
    }

    // Return the fields that were updated as confirmation
    const responseData = {
      ...userUpdates,
      ...candidateUpdates,
      ...unitUpdates,
    };

    return c.json(
      {
        status_code: OK,
        message: "Profile updated successfully",
        data: responseData,
      },
      OK,
    );
  } catch (_err) {
    console.error("Error updating profile:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
