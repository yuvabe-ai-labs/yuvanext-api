import { eq } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { units } from "@/db/schema/unit.schema";
import { mentors } from "@/db/schema/mentor.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  BAD_REQUEST,
} from "@/lib/openapi/http-status-codes";

import {
  uploadFileToS3,
  deleteFileFromS3,
  cleanupOldFile,
  cleanupOldFiles,
  generatePresignedUploadUrl,
  getPublicUrlFromKey,
  doesObjectExist,
} from "@/lib/services/s3.service";

import type {
  GetProfile,
  UpdateProfile,
  UploadAvatar,
  DeleteAvatar,
  UploadBanner,
  DeleteBanner,
  UploadGalleryImage,
  DeleteGalleryImage,
  GenerateTestimonialUploadUrl,
  CompleteTestimonialUpload,
  DeleteTestimonialVideo,
  GetMentorProfile,
  UpdateMentorProfile,
} from "./profile.routes";

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

// Helper function to calculate mentor profile score
function calculateMentorScore(mentor: any): number {
  let score = 0;
  const weights = {
    // Basic info (20 points)
    name: 5,
    email: 5,
    phone: 5,
    mentorType: 5,

    // Experience & Expertise (30 points)
    expertiseAreas: 10,
    experienceSnapshot: 10,

    // Availability (20 points)
    availabilityDays: 7,
    availabilityTimeWindows: 7,
    timezone: 6,

    // Preferences & Capacity (20 points)
    mentoringCapacity: 5,
    preferredStages: 7,
    communicationModes: 8,

    // Boundaries (10 points)
    confirmBoundaries: 10,
  };

  // Check basic fields
  if (mentor.name) score += weights.name;
  if (mentor.email) score += weights.email;
  if (mentor.phone) score += weights.phone;
  if (mentor.mentorType) score += weights.mentorType;

  // Check experience & expertise
  if (mentor.expertiseAreas && mentor.expertiseAreas.length > 0)
    score += weights.expertiseAreas;
  if (mentor.experienceSnapshot && mentor.experienceSnapshot.length > 20)
    score += weights.experienceSnapshot;

  // Check availability
  if (mentor.availabilityDays && mentor.availabilityDays.length > 0)
    score += weights.availabilityDays;
  if (
    mentor.availabilityTimeWindows &&
    mentor.availabilityTimeWindows.length > 0
  )
    score += weights.availabilityTimeWindows;
  if (mentor.timezone) score += weights.timezone;

  // Check preferences & capacity
  if (mentor.mentoringCapacity) score += weights.mentoringCapacity;
  if (mentor.preferredStages && mentor.preferredStages.length > 0)
    score += weights.preferredStages;
  if (mentor.communicationModes && mentor.communicationModes.length > 0)
    score += weights.communicationModes;

  // Check boundaries
  if (mentor.confirmBoundaries) score += weights.confirmBoundaries;

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
        name: data.unitName || data.userName,
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
    } else if (user.role === "mentor") {
      const profileData = await db
        .select({
          // User fields
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          role: userTable.role,
          createdAt: userTable.createdAt,
          updatedAt: userTable.updatedAt,
          // Mentor fields
          mentorType: mentors.mentorType,
          expertiseAreas: mentors.expertiseAreas,
          experienceSnapshot: mentors.experienceSnapshot,
          availabilityDays: mentors.availabilityDays,
          availabilityTimeWindows: mentors.availabilityTimeWindows,
          timezone: mentors.timezone,
          mentoringCapacity: mentors.mentoringCapacity,
          preferredStages: mentors.preferredStages,
          communicationModes: mentors.communicationModes,
          confirmBoundaries: mentors.confirmBoundaries,
          onboardingCompleted: mentors.onboardingCompleted,
        })
        .from(userTable)
        .leftJoin(mentors, eq(mentors.userId, userTable.id))
        .where(eq(userTable.id, user.id))
        .limit(1);

      if (!profileData || profileData.length === 0) {
        return c.json(
          { status_code: NOT_FOUND, message: "User not found" },
          NOT_FOUND,
        );
      }

      const data = profileData[0];

      // Construct mentor profile
      const mentorProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        mentorType: data.mentorType,
        expertiseAreas: data.expertiseAreas,
        experienceSnapshot: data.experienceSnapshot,
        availabilityDays: data.availabilityDays,
        availabilityTimeWindows: data.availabilityTimeWindows,
        timezone: data.timezone,
        mentoringCapacity: data.mentoringCapacity,
        preferredStages: data.preferredStages,
        communicationModes: data.communicationModes,
        confirmBoundaries: data.confirmBoundaries,
        onboardingCompleted: data.onboardingCompleted,
      };

      const profileScore = calculateMentorScore(mentorProfile);

      return c.json(
        {
          status_code: OK,
          message: "Profile retrieved successfully",
          data: {
            ...mentorProfile,
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

// POST /profile/upload-avatar - Upload avatar
export const uploadAvatar: AppRouteHandler<UploadAvatar> = async (c) => {
  const user = c.get("user");

  try {
    const { file } = c.req.valid("form");

    if (!file) {
      return c.json(
        { status_code: BAD_REQUEST, message: "No file provided" },
        BAD_REQUEST,
      );
    }

    let oldAvatarUrl: string | null = null;
    let newAvatarUrl: string | null = null;

    // Transaction: get old URL, upload new file, update DB
    await db.transaction(async (tx) => {
      // Get current avatar URL
      if (user.role === "candidate") {
        const candidate = await tx.query.candidates.findFirst({
          where: eq(candidates.userId, user.id),
        });
        oldAvatarUrl = candidate?.avatarUrl || null;
      } else if (user.role === "unit") {
        const unit = await tx.query.units.findFirst({
          where: eq(units.userId, user.id),
        });
        oldAvatarUrl = unit?.avatarUrl || null;
      }

      // Upload new avatar to S3
      newAvatarUrl = await uploadFileToS3(file, user.id, "avatar");

      // Update database within transaction
      if (user.role === "candidate") {
        await tx
          .update(candidates)
          .set({ avatarUrl: newAvatarUrl, updatedAt: new Date() })
          .where(eq(candidates.userId, user.id));
      } else if (user.role === "unit") {
        await tx
          .update(units)
          .set({ avatarUrl: newAvatarUrl, updatedAt: new Date() })
          .where(eq(units.userId, user.id));
      }
    });

    // Fire-and-forget: delete old file after successful transaction commit
    if (oldAvatarUrl) {
      void (async () => {
        try {
          await cleanupOldFile(oldAvatarUrl);
        } catch (err) {
          console.error("Error cleaning up old avatar (background):", err);
        }
      })();
    }

    return c.json(
      {
        status_code: OK,
        message: "Avatar uploaded successfully",
        data: { avatarUrl: newAvatarUrl },
      },
      OK,
    );
  } catch (_err) {
    console.error("Error uploading avatar:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to upload avatar",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /profile/avatar - Delete avatar
export const deleteAvatar: AppRouteHandler<DeleteAvatar> = async (c) => {
  const user = c.get("user");

  try {
    let avatarUrlToDelete: string | null = null;

    // Transaction: get URL and update DB
    await db.transaction(async (tx) => {
      // Get current avatar URL
      if (user.role === "candidate") {
        const candidate = await tx.query.candidates.findFirst({
          where: eq(candidates.userId, user.id),
        });
        avatarUrlToDelete = candidate?.avatarUrl || null;
      } else if (user.role === "unit") {
        const unit = await tx.query.units.findFirst({
          where: eq(units.userId, user.id),
        });
        avatarUrlToDelete = unit?.avatarUrl || null;
      }

      if (!avatarUrlToDelete) {
        throw new Error("No avatar found");
      }

      // Update database within transaction
      if (user.role === "candidate") {
        await tx
          .update(candidates)
          .set({ avatarUrl: null, updatedAt: new Date() })
          .where(eq(candidates.userId, user.id));
      } else if (user.role === "unit") {
        await tx
          .update(units)
          .set({ avatarUrl: null, updatedAt: new Date() })
          .where(eq(units.userId, user.id));
      }
    });

    // Fire-and-forget: delete from S3 after successful transaction commit
    if (avatarUrlToDelete) {
      void (async () => {
        try {
          await deleteFileFromS3(avatarUrlToDelete);
        } catch (err) {
          console.error("Error deleting avatar from S3 (background):", err);
        }
      })();
    }

    return c.json(
      {
        status_code: OK,
        message: "Avatar deleted successfully",
      },
      OK,
    );
  } catch (_err) {
    if ((_err as Error).message === "No avatar found") {
      return c.json(
        { status_code: NOT_FOUND, message: "No avatar found" },
        NOT_FOUND,
      );
    }
    console.error("Error deleting avatar:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to delete avatar",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// POST /profile/upload-banner - Upload banner (Units only)
export const uploadBanner: AppRouteHandler<UploadBanner> = async (c) => {
  const user = c.get("user");

  try {
    const { file } = c.req.valid("form");

    if (!file) {
      return c.json(
        { status_code: BAD_REQUEST, message: "No file provided" },
        BAD_REQUEST,
      );
    }

    let oldBannerUrl: string | null = null;
    let newBannerUrl: string | null = null;

    // Transaction: get old URL, upload new file, update DB
    await db.transaction(async (tx) => {
      // Get current banner URL
      const unit = await tx.query.units.findFirst({
        where: eq(units.userId, user.id),
      });
      oldBannerUrl = unit?.bannerUrl || null;

      // Upload new banner to S3
      newBannerUrl = await uploadFileToS3(file, user.id, "banner", "unit");

      // Update database within transaction
      await tx
        .update(units)
        .set({ bannerUrl: newBannerUrl, updatedAt: new Date() })
        .where(eq(units.userId, user.id));
    });

    // Fire-and-forget: delete old file after successful transaction commit
    if (oldBannerUrl) {
      void (async () => {
        try {
          await cleanupOldFile(oldBannerUrl);
        } catch (err) {
          console.error("Error cleaning up old banner (background):", err);
        }
      })();
    }

    return c.json(
      {
        status_code: OK,
        message: "Banner uploaded successfully",
        data: { bannerUrl: newBannerUrl },
      },
      OK,
    );
  } catch (_err) {
    console.error("Error uploading banner:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to upload banner",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /profile/banner - Delete banner (Units only)
export const deleteBanner: AppRouteHandler<DeleteBanner> = async (c) => {
  const user = c.get("user");

  try {
    let bannerUrlToDelete: string | null = null;

    // Transaction: get URL and update DB
    await db.transaction(async (tx) => {
      // Get current banner URL
      const unit = await tx.query.units.findFirst({
        where: eq(units.userId, user.id),
      });
      bannerUrlToDelete = unit?.bannerUrl || null;

      if (!bannerUrlToDelete) {
        throw new Error("No banner found");
      }

      // Update database within transaction
      await tx
        .update(units)
        .set({ bannerUrl: null, updatedAt: new Date() })
        .where(eq(units.userId, user.id));
    });

    // Fire-and-forget: delete from S3 after successful transaction commit
    if (bannerUrlToDelete) {
      void (async () => {
        try {
          await deleteFileFromS3(bannerUrlToDelete);
        } catch (err) {
          console.error("Error deleting banner from S3 (background):", err);
        }
      })();
    }

    return c.json(
      {
        status_code: OK,
        message: "Banner deleted successfully",
      },
      OK,
    );
  } catch (_err) {
    if ((_err as Error).message === "No banner found") {
      return c.json(
        { status_code: NOT_FOUND, message: "No banner found" },
        NOT_FOUND,
      );
    }
    console.error("Error deleting banner:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to delete banner",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// POST /profile/upload-gallery - Upload gallery image (Units only)
export const uploadGalleryImage: AppRouteHandler<UploadGalleryImage> = async (
  c,
) => {
  const user = c.get("user");

  try {
    const { file } = c.req.valid("form");

    if (!file) {
      return c.json(
        { status_code: BAD_REQUEST, message: "No file provided" },
        BAD_REQUEST,
      );
    }

    let updatedGalleryImages: string[] = [];

    // Transaction: upload file, update DB
    await db.transaction(async (tx) => {
      // Upload to S3
      const galleryImageUrl = await uploadFileToS3(
        file,
        user.id,
        "gallery",
        "unit",
      );

      // Get current gallery images
      const unit = await tx.query.units.findFirst({
        where: eq(units.userId, user.id),
      });
      let currentGalleryImages = unit?.galleryImages || [];

      // Add new image to array
      updatedGalleryImages = [...currentGalleryImages, galleryImageUrl];

      // Update database within transaction
      await tx
        .update(units)
        .set({ galleryImages: updatedGalleryImages, updatedAt: new Date() })
        .where(eq(units.userId, user.id));
    });

    return c.json(
      {
        status_code: OK,
        message: "Gallery image uploaded successfully",
        data: {
          galleryImages: updatedGalleryImages,
        },
      },
      OK,
    );
  } catch (_err) {
    console.error("Error uploading gallery image:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to upload gallery image",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /profile/gallery - Delete gallery image (Units only)
export const deleteGalleryImage: AppRouteHandler<DeleteGalleryImage> = async (
  c,
) => {
  const user = c.get("user");

  try {
    const { imageUrl } = c.req.valid("json");

    let updatedGalleryImages: string[] = [];

    // Transaction: get URL, update DB
    await db.transaction(async (tx) => {
      // Get current gallery images
      const unit = await tx.query.units.findFirst({
        where: eq(units.userId, user.id),
      });
      let currentGalleryImages = unit?.galleryImages || [];

      if (!currentGalleryImages.includes(imageUrl)) {
        throw new Error("Image not found in gallery");
      }

      // Remove from array
      updatedGalleryImages = currentGalleryImages.filter(
        (url) => url !== imageUrl,
      );

      // Update database within transaction
      await tx
        .update(units)
        .set({ galleryImages: updatedGalleryImages, updatedAt: new Date() })
        .where(eq(units.userId, user.id));
    });

    // Fire-and-forget: delete from S3 after successful transaction commit
    void (async () => {
      try {
        await deleteFileFromS3(imageUrl);
      } catch (err) {
        console.error(
          "Error deleting gallery image from S3 (background):",
          err,
        );
      }
    })();

    return c.json(
      {
        status_code: OK,
        message: "Gallery image deleted successfully",
        data: { galleryImages: updatedGalleryImages },
      },
      OK,
    );
  } catch (_err) {
    if ((_err as Error).message === "Image not found in gallery") {
      return c.json(
        { status_code: NOT_FOUND, message: "Image not found in gallery" },
        NOT_FOUND,
      );
    }
    console.error("Error deleting gallery image:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to delete gallery image",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// POST /profile/testimonial/presign - Generate presigned URL for testimonial upload (Units only)
export const generateTestimonialUploadUrl: AppRouteHandler<
  GenerateTestimonialUploadUrl
> = async (c) => {
  const user = c.get("user");

  try {
    const { fileName, expiresIn } = c.req.valid("json");

    const { url, key } = await generatePresignedUploadUrl(
      user.id,
      "testimonial-videos",
      fileName,
      expiresIn,
    );

    const fileUrl = getPublicUrlFromKey(key);

    return c.json(
      {
        status_code: OK,
        message: "Presigned URL generated",
        data: {
          uploadUrl: url,
          key,
          fileUrl,
          expiresIn,
        },
      },
      OK,
    );
  } catch (_err) {
    console.error("Error generating presigned URL:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to generate presigned URL",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// POST /profile/testimonial/complete - Finalize testimonial upload (Units only)
export const completeTestimonialUpload: AppRouteHandler<
  CompleteTestimonialUpload
> = async (c) => {
  const user = c.get("user");

  try {
    const { key } = c.req.valid("json");

    const exists = await doesObjectExist(key);
    if (!exists) {
      return c.json(
        { status_code: BAD_REQUEST, message: "Uploaded object not found" },
        BAD_REQUEST,
      );
    }

    const fileUrl = getPublicUrlFromKey(key);

    let updatedVideos: string[] = [];
    let previousVideosToDelete: string[] = [];

    await db.transaction(async (tx) => {
      const unit = await tx.query.units.findFirst({
        where: eq(units.userId, user.id),
      });
      const currentVideos = unit?.galleryVideos || [];

      // Replace existing testimonial videos with the newly uploaded one
      previousVideosToDelete = currentVideos.slice();
      updatedVideos = [fileUrl];

      await tx
        .update(units)
        .set({ galleryVideos: updatedVideos, updatedAt: new Date() })
        .where(eq(units.userId, user.id));
    });

    void (async () => {
      try {
        if (previousVideosToDelete.length > 0) {
          await cleanupOldFiles(previousVideosToDelete);
        }
      } catch (err) {
        console.error(
          "Error deleting old testimonial videos from S3 (background):",
          err,
        );
      }
    })();

    return c.json(
      {
        status_code: OK,
        message: "Testimonial video finalized and replaced",
        data: { galleryVideos: updatedVideos },
      },
      OK,
    );
  } catch (_err) {
    console.error("Error finalizing testimonial upload:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to finalize testimonial upload",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /profile/testimonial - Delete testimonial video (Units only)
export const deleteTestimonialVideo: AppRouteHandler<
  DeleteTestimonialVideo
> = async (c) => {
  const user = c.get("user");

  try {
    let videoUrl: string | undefined;
    try {
      const body = c.req.valid("json");
      videoUrl = body.videoUrl;
    } catch (e) {
      // No JSON body provided or validation failed -> treat as no videoUrl provided
      videoUrl = undefined;
    }

    let updatedVideos: string[] = [];
    let previousVideosToDelete: string[] = [];

    // Transaction: get URL(s), update DB
    await db.transaction(async (tx) => {
      // Get current videos
      const unit = await tx.query.units.findFirst({
        where: eq(units.userId, user.id),
      });
      const currentVideos = unit?.galleryVideos || [];

      if (videoUrl) {
        if (!currentVideos.includes(videoUrl)) {
          throw new Error("Video not found in gallery");
        }

        // Remove specified URL
        updatedVideos = currentVideos.filter((url) => url !== videoUrl);
        previousVideosToDelete = [videoUrl];
      } else {
        // No URL provided -> delete ALL existing testimonial videos (replace with empty)
        if (currentVideos.length === 0) {
          throw new Error("No testimonial found");
        }

        previousVideosToDelete = currentVideos.slice();
        updatedVideos = [];
      }

      // Update database within transaction
      await tx
        .update(units)
        .set({ galleryVideos: updatedVideos, updatedAt: new Date() })
        .where(eq(units.userId, user.id));
    });

    // Fire-and-forget: delete from S3 after successful transaction commit
    void (async () => {
      try {
        if (previousVideosToDelete.length > 0) {
          await cleanupOldFiles(previousVideosToDelete);
        }
      } catch (err) {
        console.error(
          "Error deleting testimonial video(s) from S3 (background):",
          err,
        );
      }
    })();

    return c.json(
      {
        status_code: OK,
        message: videoUrl
          ? "Testimonial video deleted successfully"
          : "All testimonial video(s) deleted successfully",
        data: { galleryVideos: updatedVideos },
      },
      OK,
    );
  } catch (_err) {
    if ((_err as Error).message === "Video not found in gallery") {
      return c.json(
        { status_code: NOT_FOUND, message: "Video not found in gallery" },
        NOT_FOUND,
      );
    }
    if ((_err as Error).message === "No testimonial found") {
      return c.json(
        { status_code: NOT_FOUND, message: "No testimonial found" },
        NOT_FOUND,
      );
    }
    console.error("Error deleting testimonial video:", _err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Failed to delete testimonial video",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /profile/mentor - Get mentor profile
export const getMentorProfile: AppRouteHandler<GetMentorProfile> = async (
  c,
) => {
  try {
    const user = c.get("user"); // Correctly retrieve user from context

    const mentor = await db.query.mentors.findFirst({
      where: eq(mentors.userId, user.id),
    });

    if (!mentor) {
      return c.json({ message: "Mentor profile not found" }, NOT_FOUND);
    }

    return c.json(mentor, OK);
  } catch (error) {
    console.error("Error fetching mentor profile:", error);
    return c.json({ message: "Internal server error" }, INTERNAL_SERVER_ERROR);
  }
};

// PUT /profile/mentor - Update mentor profile
export const updateMentorProfile: AppRouteHandler<UpdateMentorProfile> = async (
  c,
) => {
  try {
    const user = c.get("user"); // Correctly retrieve user from context
    const updatedData = c.req.valid("json"); // Use valid() to parse request body

    const [updatedMentor] = await db
      .update(mentors)
      .set(updatedData)
      .where(eq(mentors.userId, user.id))
      .returning();

    if (!updatedMentor) {
      return c.json({ message: "Mentor profile not found" }, NOT_FOUND);
    }

    return c.json(updatedMentor, OK);
  } catch (error) {
    console.error("Error updating mentor profile:", error);
    return c.json({ message: "Internal server error" }, INTERNAL_SERVER_ERROR);
  }
};
