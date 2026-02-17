import { and, arrayContains, eq, ilike, sql } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { mentors } from "@/db/schema/mentor.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type { GetMentorById, GetMentors } from "./mentors.routes";

/**
 * GET /candidate/mentors - Get all available mentors with filters
 */
export const getAllMentors: AppRouteHandler<GetMentors> = async (c) => {
  try {
    const { mentorType, expertiseArea, availabilityDay, limit, offset } =
      c.req.valid("query");

    // Build the where conditions dynamically
    const conditions = [eq(mentors.onboardingCompleted, true)];

    if (mentorType) {
      conditions.push(eq(mentors.mentorType, mentorType));
    }

    if (expertiseArea) {
      // For JSONB array contains check, we need to use sql operator
      conditions.push(
        sql`${mentors.expertiseAreas} @> ${JSON.stringify([expertiseArea])}`,
      );
    }

    if (availabilityDay) {
      conditions.push(
        sql`${mentors.availabilityDays} @> ${JSON.stringify([availabilityDay])}`,
      );
    }

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mentors)
      .innerJoin(userTable, eq(mentors.userId, userTable.id))
      .where(and(...conditions));

    // Get mentors with user details
    const mentorsData = await db
      .select({
        // Mentor fields
        userId: mentors.userId,
        mentorType: mentors.mentorType,
        expertiseAreas: mentors.expertiseAreas,
        experienceSnapshot: mentors.experienceSnapshot,
        availabilityDays: mentors.availabilityDays,
        availabilityTimeWindows: mentors.availabilityTimeWindows,
        timezone: mentors.timezone,
        mentoringCapacity: mentors.mentoringCapacity,
        preferredStages: mentors.preferredStages,
        communicationModes: mentors.communicationModes,
        createdAt: mentors.createdAt,

        // User fields
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
      })
      .from(mentors)
      .innerJoin(userTable, eq(mentors.userId, userTable.id))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(mentors.createdAt);

    const formattedMentors = mentorsData.map((mentor) => ({
      userId: mentor.userId,
      name: mentor.name,
      email: mentor.email,
      image: mentor.image,
      mentorType: mentor.mentorType,
      expertiseAreas: mentor.expertiseAreas,
      experienceSnapshot: mentor.experienceSnapshot,
      availabilityDays: mentor.availabilityDays,
      availabilityTimeWindows: mentor.availabilityTimeWindows,
      timezone: mentor.timezone,
      mentoringCapacity: mentor.mentoringCapacity,
      preferredStages: mentor.preferredStages,
      communicationModes: mentor.communicationModes,
      createdAt: mentor.createdAt,
    }));

    return c.json(
      {
        status_code: OK,
        message: "Mentors retrieved successfully",
        data: formattedMentors,
        total: Number(count),
        limit,
        offset,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching mentors:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /candidate/mentors/:mentorId - Get detailed mentor information
 */
export const getMentorById: AppRouteHandler<GetMentorById> = async (c) => {
  const mentorId = c.req.param("mentorId");

  try {
    // Get the specific mentor with user details
    const mentorData = await db
      .select({
        // Mentor fields
        userId: mentors.userId,
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
        createdAt: mentors.createdAt,
        updatedAt: mentors.updatedAt,

        // User fields
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
      })
      .from(mentors)
      .innerJoin(userTable, eq(mentors.userId, userTable.id))
      .where(
        and(
          eq(mentors.userId, mentorId),
          eq(mentors.onboardingCompleted, true),
        ),
      )
      .limit(1);

    if (mentorData.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Mentor not found or not available",
        },
        NOT_FOUND,
      );
    }

    const mentor = mentorData[0];

    const formattedMentor = {
      userId: mentor.userId,
      name: mentor.name,
      email: mentor.email,
      image: mentor.image,
      mentorType: mentor.mentorType,
      expertiseAreas: mentor.expertiseAreas,
      experienceSnapshot: mentor.experienceSnapshot,
      availabilityDays: mentor.availabilityDays,
      availabilityTimeWindows: mentor.availabilityTimeWindows,
      timezone: mentor.timezone,
      mentoringCapacity: mentor.mentoringCapacity,
      preferredStages: mentor.preferredStages,
      communicationModes: mentor.communicationModes,
      confirmBoundaries: mentor.confirmBoundaries,
      onboardingCompleted: mentor.onboardingCompleted,
      createdAt: mentor.createdAt,
      updatedAt: mentor.updatedAt,
    };

    return c.json(
      {
        status_code: OK,
        message: "Mentor retrieved successfully",
        data: formattedMentor,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching mentor by ID:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
