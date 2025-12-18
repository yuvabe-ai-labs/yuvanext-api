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
    // Fetch user data with role-specific data in ONE query using JOIN
    if (user.role === "candidate") {
      const profileData = await db
        .select({
          // User fields
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          image: userTable.image,
          role: userTable.role,
          createdAt: userTable.createdAt,
          updatedAt: userTable.updatedAt,
          // Candidate fields
          candidateType: candidates.type,
          experienceLevel: candidates.experienceLevel,
          profileSummary: candidates.profileSummary,
          location: candidates.location,
          maritalStatus: candidates.maritalStatus,
          isDifferentlyAbled: candidates.isDifferentlyAbled,
          hasCareerBreak: candidates.hasCareerBreak,
          skills: candidates.skills,
          interests: candidates.interests,
          lookingFor: candidates.lookingFor,
          avatarUrl: candidates.avatarUrl,
          phone: candidates.phone,
          gender: candidates.gender,
          dateOfBirth: candidates.dateOfBirth,
          onboardingCompleted: candidates.onboardingCompleted,
          education: candidates.education,
          language: candidates.language,
          course: candidates.course,
          internship: candidates.internship,
          projects: candidates.projects,
          socialLinks: candidates.socialLinks,
        })
        .from(userTable)
        .leftJoin(candidates, eq(candidates.userId, userTable.id))
        .where(eq(userTable.id, user.id))
        .limit(1);

      if (!profileData || profileData.length === 0) {
        return c.json(
          { status_code: NOT_FOUND, message: "User not found" },
          NOT_FOUND,
        );
      }

      const data = profileData[0];

      // Construct candidate profile with proper field names
      const candidateProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        image: data.image,
        role: data.role,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        type: data.candidateType,
        experienceLevel: data.experienceLevel,
        profileSummary: data.profileSummary,
        location: data.location,
        maritalStatus: data.maritalStatus,
        isDifferentlyAbled: data.isDifferentlyAbled,
        hasCareerBreak: data.hasCareerBreak,
        skills: data.skills,
        interests: data.interests,
        lookingFor: data.lookingFor,
        avatarUrl: data.avatarUrl,
        phone: data.phone,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        onboardingCompleted: data.onboardingCompleted,
        education: data.education,
        language: data.language,
        course: data.course,
        internship: data.internship,
        projects: data.projects,
        socialLinks: data.socialLinks,
      };

      const profileScore = calculateCandidateScore(candidateProfile);

      return c.json(
        {
          status_code: OK,
          message: "Profile retrieved successfully",
          data: {
            ...candidateProfile,
            profileScore,
          },
        },
        OK,
      );
    } else if (user.role === "unit") {
      const profileData = await db
        .select({
          // User fields
          id: userTable.id,
          userName: userTable.name,
          email: userTable.email,
          image: userTable.image,
          role: userTable.role,
          createdAt: userTable.createdAt,
          updatedAt: userTable.updatedAt,
          // Unit fields
          unitName: units.name,
          type: units.type,
          phone: units.phone,
          address: units.address,
          location: units.location,
          onboardingCompleted: units.onboardingCompleted,
          websiteUrl: units.websiteUrl,
          mission: units.mission,
          values: units.values,
          description: units.description,
          industry: units.industry,
          isAurovillian: units.isAurovillian,
          bannerUrl: units.bannerUrl,
          avatarUrl: units.avatarUrl,
          galleryImages: units.galleryImages,
          galleryVideos: units.galleryVideos,
          focusAreas: units.focusAreas,
          skillsOffered: units.skillsOffered,
          opportunitiesOffered: units.opportunitiesOffered,
          projects: units.projects,
          socialLinks: units.socialLinks,
        })
        .from(userTable)
        .leftJoin(units, eq(units.userId, userTable.id))
        .where(eq(userTable.id, user.id))
        .limit(1);

      if (!profileData || profileData.length === 0) {
        return c.json(
          { status_code: NOT_FOUND, message: "User not found" },
          NOT_FOUND,
        );
      }

      const data = profileData[0];

      // Construct unit profile
      const unitProfile = {
        id: data.id,
        name: data.unitName || data.userName, // Prefer unit name, fallback to user name
        email: data.email,
        image: data.image,
        role: data.role,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        type: data.type,
        phone: data.phone,
        address: data.address,
        location: data.location,
        onboardingCompleted: data.onboardingCompleted,
        websiteUrl: data.websiteUrl,
        mission: data.mission,
        values: data.values,
        description: data.description,
        industry: data.industry,
        isAurovillian: data.isAurovillian,
        bannerUrl: data.bannerUrl,
        avatarUrl: data.avatarUrl,
        galleryImages: data.galleryImages,
        galleryVideos: data.galleryVideos,
        focusAreas: data.focusAreas,
        skillsOffered: data.skillsOffered,
        opportunitiesOffered: data.opportunitiesOffered,
        projects: data.projects,
        socialLinks: data.socialLinks,
      };

      const profileScore = calculateUnitScore(unitProfile);

      return c.json(
        {
          status_code: OK,
          message: "Profile retrieved successfully",
          data: {
            ...unitProfile,
            profileScore,
          },
        },
        OK,
      );
    } else {
      // For other roles (admin, etc.), just return basic user data
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

      return c.json(
        {
          status_code: OK,
          message: "Profile retrieved successfully",
          data: {
            ...userData[0],
            profileScore: 0,
          },
        },
        OK,
      );
    }
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
      // Use Promise.all to execute both updates concurrently
      const updates = [];

      if (Object.keys(candidateUpdates).length > 0) {
        updates.push(
          db
            .update(candidates)
            .set({ ...candidateUpdates, updatedAt: now })
            .where(eq(candidates.userId, user.id)),
        );
      }

      if (Object.keys(userUpdates).length > 0) {
        updates.push(
          db
            .update(userTable)
            .set({ ...userUpdates, updatedAt: now })
            .where(eq(userTable.id, user.id)),
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } else if (user.role === "unit") {
      // For unit role, apply collected unitUpdates
      if (data.profileSummary !== undefined)
        unitUpdates.description = data.profileSummary;

      // Use Promise.all to execute both updates concurrently
      const updates = [];

      if (Object.keys(unitUpdates).length > 0) {
        updates.push(
          db
            .update(units)
            .set({ ...unitUpdates, updatedAt: now })
            .where(eq(units.userId, user.id)),
        );
      }

      if (Object.keys(userUpdates).length > 0) {
        updates.push(
          db
            .update(userTable)
            .set({ ...userUpdates, updatedAt: now })
            .where(eq(userTable.id, user.id)),
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
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
