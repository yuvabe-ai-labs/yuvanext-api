import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schemas";
import { units } from "@/db/schema/unit.schemas";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";

// Flexible update schema: accept any of the profile fields as optional
const UpdateProfileSchema = z
  .object({
    // user fields
    name: z.string().min(1).optional(),
    image: z.string().url().optional(),

    // candidate/unit shared/simple fields
    profileSummary: z.string().min(1).max(2000).optional(),
    avatarUrl: z.string().url().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),

    // candidate-specific complex fields (allow loose types to keep flexibility)
    type: z.string().optional(),
    experienceLevel: z.string().optional(),
    maritalStatus: z.string().optional(),
    isDifferentlyAbled: z.boolean().optional(),
    hasCareerBreak: z.boolean().optional(),
    skills: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    lookingFor: z.array(z.string()).optional(),
    gender: z.string().optional(),
    dateOfBirth: z.string().optional(),
    onboardingCompleted: z.boolean().optional(),
    education: z.array(z.any()).optional(),
    language: z.array(z.string()).optional(),
    course: z.array(z.any()).optional(),
    internship: z.array(z.any()).optional(),
    projects: z.array(z.any()).optional(),
    socialLinks: z.record(z.string(), z.string()).optional(),
    // unit-specific fields
    websiteUrl: z.string().url().optional(),
    mission: z.string().optional(),
    values: z.string().optional(),
    description: z.string().optional(),
    industry: z.string().optional(),
    isAurovillian: z.boolean().optional(),
    bannerUrl: z.string().url().optional(),
    galleryImages: z.array(z.string()).optional(),
    galleryVideos: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
    skillsOffered: z.array(z.string()).optional(),
    opportunitiesOffered: z.array(z.any()).optional(),
  })
  .partial()
  .catchall(z.any());

const _UpdateAvatarSchema = z.object({
  avatarUrl: z.string().url(),
});

// GET /profile - Get user profile
export const getProfile: AppRouteHandler<any> = async (c) => {
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
    let profileData: any = {
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
        };
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
        };
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
export const updateProfile: AppRouteHandler<any> = async (c) => {
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

    const data = parsed.data as Record<string, any>;

    // Prepare updates for user and role-specific tables
    const userUpdates: Record<string, any> = {};
    const candidateUpdates: Record<string, any> = {};
    const unitUpdates: Record<string, any> = {};

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
    ];

    for (const key of candidateFields) {
      if (data[key] !== undefined) {
        // Special handling: convert date strings to Date for dateOfBirth
        if (key === "dateOfBirth") {
          try {
            candidateUpdates.dateOfBirth = new Date(data[key]);
          } catch {
            candidateUpdates.dateOfBirth = data[key];
          }
        } else {
          candidateUpdates[key] = data[key];
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
    ];

    for (const key of unitFields) {
      if (data[key] !== undefined) {
        unitUpdates[key] = data[key];
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

// GET /profile/completion-percentage - Get profile completion %
export const getCompletionPercentage: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  try {
    let completionPercentage = 0;

    if (user.role === "candidate") {
      const candidateData = await db
        .select()
        .from(candidates)
        .where(eq(candidates.userId, user.id))
        .limit(1);

      if (candidateData.length > 0) {
        const profile = candidateData[0];
        let filledFields = 0;
        const totalFields = 12; // Adjust based on profile fields

        // Check which fields are filled
        if (profile.type) filledFields++;
        if (profile.profileSummary) filledFields++;
        if (profile.location) filledFields++;
        if (profile.skills && profile.skills.length > 0) filledFields++;
        if (profile.interests && profile.interests.length > 0) filledFields++;
        if (profile.phone) filledFields++;
        if (profile.gender) filledFields++;
        if (profile.dateOfBirth) filledFields++;
        if (profile.education && profile.education.length > 0) filledFields++;
        if (profile.experienceLevel) filledFields++;
        if (profile.avatarUrl) filledFields++;
        if (profile.language && profile.language.length > 0) filledFields++;

        completionPercentage = Math.round((filledFields / totalFields) * 100);
      }
    } else if (user.role === "unit") {
      const unitData = await db
        .select()
        .from(units)
        .where(eq(units.userId, user.id))
        .limit(1);

      if (unitData.length > 0) {
        const profile = unitData[0];
        let filledFields = 0;
        const totalFields = 11; // Adjust based on profile fields

        // Check which fields are filled
        if (profile.name) filledFields++;
        if (profile.phone) filledFields++;
        if (profile.address) filledFields++;
        if (profile.websiteUrl) filledFields++;
        if (profile.description) filledFields++;
        if (profile.industry) filledFields++;
        if (profile.focusAreas && profile.focusAreas.length > 0) filledFields++;
        if (profile.skillsOffered && profile.skillsOffered.length > 0)
          filledFields++;
        if (profile.avatarUrl) filledFields++;
        if (profile.bannerUrl) filledFields++;
        if (profile.socialLinks && Object.keys(profile.socialLinks).length > 0)
          filledFields++;

        completionPercentage = Math.round((filledFields / totalFields) * 100);
      }
    }

    return c.json(
      {
        status_code: OK,
        message: "Profile completion percentage retrieved successfully",
        data: { completionPercentage },
      },
      OK,
    );
  } catch (_err) {
    console.error("Error calculating completion percentage:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
