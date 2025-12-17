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
} from "@/lib/openapi/http-status-codes";

import type { GetProfile, UpdateProfile } from "./profile.routes";

// Helper function to calculate candidate profile score
function calculateCandidateScore(candidate: any): number {
  let score = 0;
  const weights = {
    // Basic info (30 points)
    name: 5,
    email: 5,
    phone: 5,
    location: 5,
    avatarUrl: 5,
    dateOfBirth: 5,

    // Profile details (25 points)
    profileSummary: 10,
    type: 5,
    experienceLevel: 5,
    gender: 5,

    // Professional info (25 points)
    skills: 10,
    interests: 5,
    lookingFor: 5,
    education: 5,

    // Additional info (20 points)
    language: 5,
    projects: 5,
    course: 5,
    internship: 5,
    socialLinks: 5,
  };

  // Check basic fields
  if (candidate.name) score += weights.name;
  if (candidate.email) score += weights.email;
  if (candidate.phone) score += weights.phone;
  if (candidate.location) score += weights.location;
  if (candidate.avatarUrl) score += weights.avatarUrl;
  if (candidate.dateOfBirth) score += weights.dateOfBirth;

  // Check profile details
  if (candidate.profileSummary && candidate.profileSummary.length > 50)
    score += weights.profileSummary;
  if (candidate.type) score += weights.type;
  if (candidate.experienceLevel) score += weights.experienceLevel;
  if (candidate.gender) score += weights.gender;

  // Check professional info
  if (candidate.skills && candidate.skills.length > 0) score += weights.skills;
  if (candidate.interests && candidate.interests.length > 0)
    score += weights.interests;
  if (candidate.lookingFor && candidate.lookingFor.length > 0)
    score += weights.lookingFor;
  if (candidate.education && candidate.education.length > 0)
    score += weights.education;

  // Check additional info
  if (candidate.language && candidate.language.length > 0)
    score += weights.language;
  if (candidate.projects && candidate.projects.length > 0)
    score += weights.projects;
  if (candidate.course && candidate.course.length > 0) score += weights.course;
  if (candidate.internship && candidate.internship.length > 0)
    score += weights.internship;
  if (candidate.socialLinks && Object.keys(candidate.socialLinks).length > 0)
    score += weights.socialLinks;

  return Math.min(score, 100);
}

// Helper function to calculate unit profile score
function calculateUnitScore(unit: any): number {
  let score = 0;
  const weights = {
    // Basic info (30 points)
    name: 10,
    email: 5,
    phone: 5,
    location: 5,
    avatarUrl: 5,

    // Profile details (30 points)
    description: 10,
    type: 5,
    industry: 5,
    mission: 5,
    values: 5,

    // Visual content (20 points)
    bannerUrl: 5,
    galleryImages: 10,
    galleryVideos: 5,

    // Professional info (20 points)
    focusAreas: 5,
    skillsOffered: 5,
    opportunitiesOffered: 5,
    projects: 5,
    websiteUrl: 5,
    socialLinks: 5,
  };

  // Check basic fields
  if (unit.name) score += weights.name;
  if (unit.email) score += weights.email;
  if (unit.phone) score += weights.phone;
  if (unit.location) score += weights.location;
  if (unit.avatarUrl) score += weights.avatarUrl;

  // Check profile details
  if (unit.description && unit.description.length > 50)
    score += weights.description;
  if (unit.type) score += weights.type;
  if (unit.industry) score += weights.industry;
  if (unit.mission) score += weights.mission;
  if (unit.values) score += weights.values;

  // Check visual content
  if (unit.bannerUrl) score += weights.bannerUrl;
  if (unit.galleryImages && unit.galleryImages.length > 0)
    score += weights.galleryImages;
  if (unit.galleryVideos && unit.galleryVideos.length > 0)
    score += weights.galleryVideos;

  // Check professional info
  if (unit.focusAreas && unit.focusAreas.length > 0)
    score += weights.focusAreas;
  if (unit.skillsOffered && unit.skillsOffered.length > 0)
    score += weights.skillsOffered;
  if (unit.opportunitiesOffered && unit.opportunitiesOffered.length > 0)
    score += weights.opportunitiesOffered;
  if (unit.projects && unit.projects.length > 0) score += weights.projects;
  if (unit.websiteUrl) score += weights.websiteUrl;
  if (unit.socialLinks && Object.keys(unit.socialLinks).length > 0)
    score += weights.socialLinks;

  return Math.min(score, 100);
}

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

    let profileScore = 0;

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

        // Calculate candidate profile score
        profileScore = calculateCandidateScore(profileData);
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

        // Calculate unit profile score
        profileScore = calculateUnitScore(profileData);
      }
    }

    return c.json(
      {
        status_code: OK,
        message: "Profile retrieved successfully",
        data: {
          ...profileData,
          profileScore,
        },
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
    const data = c.req.valid("json");
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
