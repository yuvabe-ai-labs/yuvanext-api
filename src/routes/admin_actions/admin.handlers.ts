import { desc, eq } from "drizzle-orm";
import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type { GetAllCandidates, GetCandidateById } from "./admin.routes";

// GET /admin/candidates - Get all candidates (admin only)
export const getAllCandidates: AppRouteHandler<GetAllCandidates> = async (
  c,
) => {
  try {
    // Get all candidates with their basic information
    const candidatesList = await db
      .select({
        userId: candidates.userId,
        avatarUrl: candidates.avatarUrl,
        name: userTable.name,
        address: candidates.location,
        candidateType: candidates.type,
      })
      .from(candidates)
      .leftJoin(userTable, eq(candidates.userId, userTable.id))
      .orderBy(desc(candidates.createdAt));

    return c.json(
      {
        status_code: OK,
        message: "Candidates retrieved successfully",
        data: candidatesList,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching candidates:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /admin/candidates/:id - Get specific candidate by ID (admin only)
export const getCandidateById: AppRouteHandler<GetCandidateById> = async (
  c,
) => {
  const { id } = c.req.valid("param");

  try {
    // Get specific candidate with full details
    const candidateData = await db
      .select({
        userId: candidates.userId,
        email: userTable.email,
        name: userTable.name,
        type: candidates.type,
        experienceLevel: candidates.experienceLevel,
        profileSummary: candidates.profileSummary,
        location: candidates.location,
        maritalStatus: candidates.maritalStatus,
        isDifferentlyAbled: candidates.isDifferentlyAbled,
        hasCareerBreak: candidates.hasCareerBreak,
        createdAt: candidates.createdAt,
        updatedAt: candidates.updatedAt,
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
      .from(candidates)
      .leftJoin(userTable, eq(candidates.userId, userTable.id))
      .where(eq(candidates.userId, id))
      .limit(1);

    if (!candidateData || candidateData.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Candidate not found" },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Candidate details retrieved successfully",
        data: candidateData[0],
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching candidate details:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
