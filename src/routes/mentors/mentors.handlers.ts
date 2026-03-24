import { and, count, desc, eq, ilike, sql } from "drizzle-orm";

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
 * GET /mentors
 *
 * Returns a paginated list of onboarded mentors.
 * Filters: search (name), mentorType, expertiseArea, availabilityDay
 * Pagination: page / limit → response includes pagination metadata
 */
export const getAllMentors: AppRouteHandler<GetMentors> = async (c) => {
  const {
    search,
    mentorType,
    expertiseArea,
    availabilityDay,
    page = 1,
    limit = 10,
  } = c.req.valid("query");

  const candidateId = c.get("user")?.id; // Get user from context

  try {
    const offset = (page - 1) * limit;

    // Build dynamic WHERE conditions
    const conditions = [eq(mentors.onboardingCompleted, true)];

    // search → case-insensitive match on the user's name
    if (search) {
      conditions.push(ilike(userTable.name, `%${search}%`));
    }

    if (mentorType) {
      conditions.push(eq(mentors.mentorType, mentorType));
    }

    // JSONB array-contains: expertiseAreas @> '["<value>"]'
    if (expertiseArea) {
      conditions.push(
        sql`${mentors.expertiseAreas} @> ${JSON.stringify([expertiseArea])}`,
      );
    }

    // JSONB array-contains: availabilityDays @> '["<value>"]'
    if (availabilityDay) {
      conditions.push(
        sql`${mentors.availabilityDays} @> ${JSON.stringify([availabilityDay])}`,
      );
    }

    // Run data query and count query in parallel (mirrors admin pattern)
    const [mentorsList, totalCountResult] = await Promise.all([
      db
        .select({
          userId: mentors.userId,
          mentorType: mentors.mentorType,
          expertiseAreas: mentors.expertiseAreas,
          experienceSnapshot: mentors.experienceSnapshot,
          availabilityDays: mentors.availabilityDays,
          // User fields
          name: userTable.name,
          email: userTable.email,
          // Check if the candidate already has a mentorship with the mentor
          isCurrentMentor: sql`EXISTS (
            SELECT 1
            FROM mentorship_requests
            WHERE mentorship_requests.candidate_id = ${candidateId}
              AND mentorship_requests.mentor_id = mentors.user_id
              AND mentorship_requests.status = 'accepted'
          )`.as<boolean>(),
        })
        .from(mentors)
        .innerJoin(userTable, eq(mentors.userId, userTable.id))
        .where(and(...conditions))
        .orderBy(desc(mentors.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(mentors)
        .innerJoin(userTable, eq(mentors.userId, userTable.id))
        .where(and(...conditions)),
    ]);

    const totalItems = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    return c.json(
      {
        status_code: OK,
        message: "Mentors retrieved successfully",
        data: mentorsList.map((mentor) => ({
          ...mentor,
          isCurrentMentor: mentor.isCurrentMentor || false,
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
        },
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
 * GET /candidate/mentors/:mentorId
 *
 * Returns full profile for a single onboarded mentor.
 */
export const getMentorById: AppRouteHandler<GetMentorById> = async (c) => {
  const mentorId = c.req.param("mentorId");
  const candidateId = c.get("user")?.id;

  try {
    const mentorData = await db
      .select({
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
        // Check if the mentor is the current mentor for the candidate
        isCurrentMentor: sql`EXISTS (
          SELECT 1
          FROM mentorship_requests
          WHERE mentorship_requests.candidate_id = ${candidateId}
            AND mentorship_requests.mentor_id = ${mentorId}
            AND mentorship_requests.status = 'accepted'
        )`.as<boolean>(),
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

    return c.json(
      {
        status_code: OK,
        message: "Mentor retrieved successfully",
        data: {
          ...mentorData[0],
          isCurrentMentor: mentorData[0].isCurrentMentor || false,
        },
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
