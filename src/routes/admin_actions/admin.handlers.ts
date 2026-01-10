import { and, count, desc, eq, sql } from "drizzle-orm";
import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { user as userTable, account, session } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { courses } from "@/db/schema/course.schema";
import { internships } from "@/db/schema/internship.schema";
import { interviews } from "@/db/schema/interview.schema";
import { tasks } from "@/db/schema/task.management.schema";
import { units } from "@/db/schema/unit.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  CREATED,
  CONFLICT,
  BAD_REQUEST,
} from "@/lib/openapi/http-status-codes";
import { auth } from "@/config/auth";

import type {
  GetOverallStats,
  GetCandidates,
  GetCandidateById,
  GetUnits,
  GetApplications,
  GetUnitStats,
  AddCompany,
  DeactivateUnit,
} from "./admin.routes";

// 1. GET /admin/stats/overview - Overall Statistics
export const getOverallStats: AppRouteHandler<GetOverallStats> = async (c) => {
  try {
    const [
      totalUnitsResult,
      totalCandidatesResult,
      totalActiveInternshipsResult,
      totalCoursesResult,
      totalHiredCandidatesResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(units),
      db.select({ count: count() }).from(candidates),
      db
        .select({ count: count() })
        .from(internships)
        .where(eq(internships.status, "active")),
      db.select({ count: count() }).from(courses),
      db
        .select({ count: count() })
        .from(applications)
        .where(eq(applications.status, "hired")),
    ]);

    return c.json(
      {
        status_code: OK,
        message: "Overall statistics retrieved successfully",
        data: {
          totalUnits: totalUnitsResult[0]?.count || 0,
          totalCandidates: totalCandidatesResult[0]?.count || 0,
          totalActiveInternships: totalActiveInternshipsResult[0]?.count || 0,
          totalCourses: totalCoursesResult[0]?.count || 0,
          totalHiredCandidates: totalHiredCandidatesResult[0]?.count || 0,
          healthPercentage: 97,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching overall stats:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 13. POST /admin/units/add-company - Add Company/Unit by Admin
export const addCompany: AppRouteHandler<AddCompany> = async (c) => {
  const body = c.req.valid("json");

  try {
    // Check if email already exists
    const existingUser = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, body.companyEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return c.json(
        {
          status_code: CONFLICT,
          message: "Email already exists",
        },
        CONFLICT,
      );
    }

    // Use Better Auth's signup method
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: body.companyEmail,
        password: body.password,
        name: body.companyName,
        // Store unit-specific data in metadata for later processing
        metadata: {
          role: "unit",
          companyType: body.companyType,
          contactNumber: body.contactNumber,
          industryType: body.industryType,
          address: body.address,
          aboutCompany: body.aboutCompany,
          serviceOffered: body.serviceOffered,
          achievements: body.achievements || "",
        },
      },
    });

    if (!signUpResult) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Failed to create user account",
        },
        BAD_REQUEST,
      );
    }

    // Extract user data from Better Auth response
    const userData = signUpResult.user;

    return c.json(
      {
        status_code: CREATED,
        message: "Company created successfully. Verification email sent.",
        data: {
          userId: userData.id,
          email: userData.email,
          name: userData.name,
          message: "Please verify email to activate the account",
        },
      },
      CREATED,
    );
  } catch (err: any) {
    console.error("Error adding company:", err);

    // Handle specific Better Auth errors
    if (err.message?.includes("already exists")) {
      return c.json(
        {
          status_code: CONFLICT,
          message: "Email already exists",
        },
        CONFLICT,
      );
    }

    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 14. PATCH /admin/units/:id/deactivate - Deactivate Unit by Admin
export const deactivateUnit: AppRouteHandler<DeactivateUnit> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    // Check if unit exists
    const existingUnit = await db
      .select({ userId: units.userId })
      .from(units)
      .where(eq(units.userId, id))
      .limit(1);

    if (existingUnit.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Unit not found",
        },
        NOT_FOUND,
      );
    }

    // Check if user exists
    const existingUser = await db
      .select({
        id: userTable.id,
        role: userTable.role,
        accountDisabled: userTable.accountDisabled,
      })
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);

    if (existingUser.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "User not found",
        },
        NOT_FOUND,
      );
    }

    if (existingUser[0].role !== "unit") {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "User is not a unit account",
        },
        BAD_REQUEST,
      );
    }

    // Deactivate the user account
    await db
      .update(userTable)
      .set({
        accountDisabled: true,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, id));

    // Remove all active sessions for this user
    await db.delete(session).where(eq(session.userId, id));

    return c.json(
      {
        status_code: OK,
        message: "Unit deactivated successfully",
        data: {
          userId: id,
          accountDisabled: true,
          message: "Unit account has been deactivated and all sessions removed",
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error deactivating unit:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 2-3. GET /admin/candidates - Get Candidates with Filters
export const getCandidates: AppRouteHandler<GetCandidates> = async (c) => {
  const { filter = "all", page = 1, limit = 10 } = c.req.valid("query");

  try {
    switch (filter) {
      case "recent": {
        // Get 10 most recent candidates
        const recentCandidates = await db
          .select({
            userId: candidates.userId,
            name: userTable.name,
            type: candidates.type,
            location: candidates.location,
          })
          .from(candidates)
          .leftJoin(userTable, eq(candidates.userId, userTable.id))
          .orderBy(desc(candidates.createdAt))
          .limit(10);

        return c.json(
          {
            status_code: OK,
            message: "Recent candidates retrieved successfully",
            data: recentCandidates,
          },
          OK,
        );
      }

      case "all": {
        // Get all candidates with pagination
        const offset = (page - 1) * limit;

        const [allCandidates, totalCountResult] = await Promise.all([
          db
            .select({
              userId: candidates.userId,
              name: userTable.name,
              type: candidates.type,
              location: candidates.location,
            })
            .from(candidates)
            .leftJoin(userTable, eq(candidates.userId, userTable.id))
            .orderBy(desc(candidates.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ count: count() }).from(candidates),
        ]);

        const totalItems = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return c.json(
          {
            status_code: OK,
            message: "All candidates retrieved successfully",
            data: allCandidates,
            pagination: {
              currentPage: page,
              totalPages,
              totalItems,
              itemsPerPage: limit,
            },
          },
          OK,
        );
      }

      case "applied": {
        // Get applied candidates with pagination
        const offset = (page - 1) * limit;

        const [appliedCandidates, totalCountResult] = await Promise.all([
          db
            .select({
              candidateId: candidates.userId,
              avatarUrl: candidates.avatarUrl,
              name: userTable.name,
              internshipName: internships.title,
              applicationStatus: applications.status,
              skills: candidates.skills,
              interests: candidates.interests,
            })
            .from(applications)
            .innerJoin(candidates, eq(applications.userId, candidates.userId))
            .leftJoin(userTable, eq(candidates.userId, userTable.id))
            .innerJoin(
              internships,
              eq(applications.internshipId, internships.id),
            )
            .where(eq(applications.status, "applied"))
            .orderBy(desc(applications.createdAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(applications)
            .where(eq(applications.status, "applied")),
        ]);

        const totalItems = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return c.json(
          {
            status_code: OK,
            message: "Applied candidates retrieved successfully",
            data: {
              data: appliedCandidates,
              pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
              },
            },
          },
          OK,
        );
      }

      case "hired": {
        // Get hired candidates with pagination
        const offset = (page - 1) * limit;

        const [hiredCandidates, totalCountResult] = await Promise.all([
          db
            .select({
              candidateId: candidates.userId,
              avatarUrl: candidates.avatarUrl,
              name: userTable.name,
              internshipName: internships.title,
              applicationStatus: applications.status,
              unitAvatarUrl: units.avatarUrl,
              internshipDuration: internships.duration,
              internshipJobType: internships.jobType,
              applicationId: applications.id,
              hasTask: sql<boolean>`EXISTS(
                SELECT 1 FROM ${tasks}
                WHERE ${tasks.applicationId} = ${applications.id}
              )`,
            })
            .from(applications)
            .innerJoin(candidates, eq(applications.userId, candidates.userId))
            .leftJoin(userTable, eq(candidates.userId, userTable.id))
            .innerJoin(
              internships,
              eq(applications.internshipId, internships.id),
            )
            .leftJoin(units, eq(internships.createdBy, units.userId))
            .where(eq(applications.status, "hired"))
            .orderBy(desc(applications.updatedAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(applications)
            .where(eq(applications.status, "hired")),
        ]);

        const totalItems = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return c.json(
          {
            status_code: OK,
            message: "Hired candidates retrieved successfully",
            data: {
              data: hiredCandidates,
              pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
              },
            },
          },
          OK,
        );
      }

      case "shortlisted": {
        // Get shortlisted candidates with pagination
        const offset = (page - 1) * limit;

        const [shortlistedCandidates, totalCountResult] = await Promise.all([
          db
            .select({
              candidateId: candidates.userId,
              avatarUrl: candidates.avatarUrl,
              name: userTable.name,
              internshipName: internships.title,
              applicationStatus: applications.status,
              skills: candidates.skills,
              interests: candidates.interests,
            })
            .from(applications)
            .innerJoin(candidates, eq(applications.userId, candidates.userId))
            .leftJoin(userTable, eq(candidates.userId, userTable.id))
            .innerJoin(
              internships,
              eq(applications.internshipId, internships.id),
            )
            .where(eq(applications.status, "shortlisted"))
            .orderBy(desc(applications.updatedAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(applications)
            .where(eq(applications.status, "shortlisted")),
        ]);

        const totalItems = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return c.json(
          {
            status_code: OK,
            message: "Shortlisted candidates retrieved successfully",
            data: {
              data: shortlistedCandidates,
              pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
              },
            },
          },
          OK,
        );
      }

      default:
        return c.json(
          {
            status_code: INTERNAL_SERVER_ERROR,
            message: "Invalid filter parameter",
          },
          INTERNAL_SERVER_ERROR,
        );
    }
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

// GET /admin/candidates/:id - Get Candidate Details by ID
export const getCandidateById: AppRouteHandler<GetCandidateById> = async (
  c,
) => {
  const { id } = c.req.valid("param");

  try {
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

// 4-5-7. GET /admin/units - Get Units with Filters
export const getUnits: AppRouteHandler<GetUnits> = async (c) => {
  const { filter = "active", page = 1, limit = 10 } = c.req.valid("query");

  try {
    switch (filter) {
      case "recent": {
        // Get 10 most recently joined units
        const recentUnits = await db
          .select({
            userId: units.userId,
            name: units.name,
            address: units.address,
          })
          .from(units)
          .orderBy(desc(units.createdAt))
          .limit(10);

        return c.json(
          {
            status_code: OK,
            message: "Recent units retrieved successfully",
            data: recentUnits,
          },
          OK,
        );
      }

      case "active": {
        // Get active units with stats (paginated or limited to 10)
        const offset = page > 1 ? (page - 1) * limit : 0;
        const actualLimit = page > 1 ? limit : 10;

        const [activeUnits, totalCountResult] = await Promise.all([
          db
            .select({
              userId: units.userId,
              name: units.name,
              email: userTable.email,
              totalApplications: sql<number>`COUNT(DISTINCT ${applications.id})`,
              totalActiveInternships: sql<number>`COUNT(DISTINCT CASE WHEN ${internships.status} = 'active' THEN ${internships.id} END)`,
            })
            .from(units)
            .leftJoin(userTable, eq(units.userId, userTable.id))
            .leftJoin(internships, eq(units.userId, internships.createdBy))
            .leftJoin(
              applications,
              eq(internships.id, applications.internshipId),
            )
            .groupBy(units.userId, units.name, userTable.email)
            .orderBy(desc(units.createdAt))
            .limit(actualLimit)
            .offset(offset),
          db.select({ count: count() }).from(units),
        ]);

        // If pagination requested (page > 1), return paginated response
        if (page > 1) {
          const totalItems = totalCountResult[0]?.count || 0;
          const totalPages = Math.ceil(totalItems / limit);

          return c.json(
            {
              status_code: OK,
              message: "Active units retrieved successfully",
              data: {
                data: activeUnits,
                pagination: {
                  currentPage: page,
                  totalPages,
                  totalItems,
                  itemsPerPage: limit,
                },
              },
            },
            OK,
          );
        }

        // Otherwise return simple array of 10
        return c.json(
          {
            status_code: OK,
            message: "Active units retrieved successfully",
            data: activeUnits,
          },
          OK,
        );
      }

      default:
        return c.json(
          {
            status_code: INTERNAL_SERVER_ERROR,
            message: "Invalid filter parameter",
          },
          INTERNAL_SERVER_ERROR,
        );
    }
  } catch (err) {
    console.error("Error fetching units:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 6-10. GET /admin/applications - Get Applications with Filters
export const getApplications: AppRouteHandler<GetApplications> = async (c) => {
  const { filter = "recent", page = 1, limit = 10 } = c.req.valid("query");

  try {
    switch (filter) {
      case "recent": {
        // Get 10 most recent applied candidates across all units
        const recentApplications = await db
          .select({
            applicationId: applications.id,
            candidateId: candidates.userId,
            candidateName: userTable.name,
            candidateAvatar: candidates.avatarUrl,
            internshipTitle: internships.title,
            applicationStatus: applications.status,
            appliedAt: applications.createdAt,
            unitName: units.name,
          })
          .from(applications)
          .innerJoin(candidates, eq(applications.userId, candidates.userId))
          .leftJoin(userTable, eq(candidates.userId, userTable.id))
          .innerJoin(internships, eq(applications.internshipId, internships.id))
          .leftJoin(units, eq(internships.createdBy, units.userId))
          .orderBy(desc(applications.createdAt))
          .limit(10);

        return c.json(
          {
            status_code: OK,
            message: "Recent applications retrieved successfully",
            data: recentApplications,
          },
          OK,
        );
      }

      case "interview": {
        // Get interview scheduled candidates with pagination
        const offset = (page - 1) * limit;

        const [interviewData, totalCountResult] = await Promise.all([
          db
            .select({
              candidateId: candidates.userId,
              name: userTable.name,
              avatarUrl: candidates.avatarUrl,
              profileSummary: candidates.profileSummary,
              internshipDuration: internships.duration,
              internshipJobType: internships.jobType,
              unitId: units.userId,
              unitAvatarUrl: units.avatarUrl,
              applicationId: applications.id,
              interviewDate: interviews.scheduledDate,
            })
            .from(interviews)
            .innerJoin(
              applications,
              eq(interviews.applicationId, applications.id),
            )
            .innerJoin(candidates, eq(applications.userId, candidates.userId))
            .leftJoin(userTable, eq(candidates.userId, userTable.id))
            .innerJoin(
              internships,
              eq(applications.internshipId, internships.id),
            )
            .leftJoin(units, eq(internships.createdBy, units.userId))
            .orderBy(desc(interviews.scheduledDate))
            .limit(limit)
            .offset(offset),
          db.select({ count: count() }).from(interviews),
        ]);

        const totalItems = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return c.json(
          {
            status_code: OK,
            message: "Interview scheduled candidates retrieved successfully",
            data: {
              data: interviewData,
              pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
              },
            },
          },
          OK,
        );
      }

      default:
        return c.json(
          {
            status_code: INTERNAL_SERVER_ERROR,
            message: "Invalid filter parameter",
          },
          INTERNAL_SERVER_ERROR,
        );
    }
  } catch (err) {
    console.error("Error fetching applications:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 12. GET /admin/stats/units - Unit Registration Statistics
export const getUnitStats: AppRouteHandler<GetUnitStats> = async (c) => {
  try {
    const [
      totalRegisteredUnitsResult,
      activeUnitsResult,
      activeJobPostsResult,
      totalApplicationsResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(units),
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${units.userId})` })
        .from(units)
        .innerJoin(internships, eq(units.userId, internships.createdBy))
        .where(eq(internships.status, "active")),
      db
        .select({ count: count() })
        .from(internships)
        .where(eq(internships.status, "active")),
      db.select({ count: count() }).from(applications),
    ]);

    return c.json(
      {
        status_code: OK,
        message: "Unit statistics retrieved successfully",
        data: {
          totalRegisteredUnits: totalRegisteredUnitsResult[0]?.count || 0,
          activeUnits: activeUnitsResult[0]?.count || 0,
          activeJobPosts: activeJobPostsResult[0]?.count || 0,
          totalApplications: totalApplicationsResult[0]?.count || 0,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching unit stats:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
