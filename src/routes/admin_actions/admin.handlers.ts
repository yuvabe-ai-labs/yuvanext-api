import { and, count, desc, eq, sql } from "drizzle-orm";
import type { AppRouteHandler } from "@/types/app.types";
import crypto from "crypto";
import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { user as userTable, session } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { courses } from "@/db/schema/course.schema";
import { internships } from "@/db/schema/internship.schema";
import { interviews } from "@/db/schema/interview.schema";
import { invitations } from "@/db/schema/invitation.schema";
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
import { sendInvitationEmail } from "@/routes/auth/auth.service";

import type {
  GetOverallStats,
  GetCandidates,
  GetCandidateById,
  GetUnits,
  GetApplications,
  GetUnitStats,
  AddCompany,
  DeactivateUnit,
  ActivateUnit,
  GetAllCandidatesAndUnits,
  DisableInternship,
  EnableInternship,
  GetAllInternships,
} from "./admin.routes";
import env from "@/config/env";

// 1. GET /admin/stats/overview - Overall Statistics
export const getOverallStats: AppRouteHandler<GetOverallStats> = async (c) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      unitsResult,
      candidatesResult,
      internshipsResult,
      coursesResult,
      hiredCandidatesResult,
    ] = await Promise.all([
      // Total units and new units this month
      db
        .select({
          total: count(),
          thisMonth: sql<number>`COUNT(*) FILTER (WHERE ${units.createdAt} >= ${startOfMonth})`,
        })
        .from(units),

      // Total candidates and new candidates this month
      db
        .select({
          total: count(),
          thisMonth: sql<number>`COUNT(*) FILTER (WHERE ${candidates.createdAt} >= ${startOfMonth})`,
        })
        .from(candidates),

      // Total active internships and new active internships this month
      db
        .select({
          total: count(),
          thisMonth: sql<number>`COUNT(*) FILTER (WHERE ${internships.createdAt} >= ${startOfMonth})`,
        })
        .from(internships)
        .where(eq(internships.status, "active")),

      // Total courses and new courses this month
      db
        .select({
          total: count(),
          thisMonth: sql<number>`COUNT(*) FILTER (WHERE ${courses.createdAt} >= ${startOfMonth})`,
        })
        .from(courses),

      // Total hired candidates and new hires this month
      db
        .select({
          total: count(),
          thisMonth: sql<number>`COUNT(*) FILTER (WHERE ${applications.updatedAt} >= ${startOfMonth})`,
        })
        .from(applications)
        .where(eq(applications.status, "hired")),
    ]);

    return c.json(
      {
        status_code: OK,
        message: "Overall statistics retrieved successfully",
        data: {
          totalUnits: unitsResult[0]?.total || 0,
          newUnitsThisMonth: unitsResult[0]?.thisMonth || 0,
          totalCandidates: candidatesResult[0]?.total || 0,
          newCandidatesThisMonth: candidatesResult[0]?.thisMonth || 0,
          totalActiveInternships: internshipsResult[0]?.total || 0,
          newInternshipsThisMonth: internshipsResult[0]?.thisMonth || 0,
          totalCourses: coursesResult[0]?.total || 0,
          newCoursesThisMonth: coursesResult[0]?.thisMonth || 0,
          totalHiredCandidates: hiredCandidatesResult[0]?.total || 0,
          newHiresThisMonth: hiredCandidatesResult[0]?.thisMonth || 0,
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

// 13. POST /admin/units/add-company - Add Company/Unit by Admin (Create Invitation)
export const addCompany: AppRouteHandler<AddCompany> = async (c) => {
  const body = c.req.valid("json");
  // get the FRONTEND_URL from env
  const FRONTEND_URL = env.FRONTEND_URL;

  try {
    // Check if email already exists in users or invitations
    const existingUser = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, body.email))
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

    // Check if invitation already exists and is pending
    const existingInvitation = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, body.email),
          eq(invitations.status, "pending"),
        ),
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return c.json(
        {
          status_code: CONFLICT,
          message: "Invitation already exists for this email",
        },
        CONFLICT,
      );
    }

    // Generate unique invitation token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Create invitation record
    const newInvitation = await db
      .insert(invitations)
      .values({
        email: body.email,
        invitationUrl: "", // Will be updated after we get the ID
        role: "unit",
        companyName: body.name,
        companyType: body.companyType,
        contactNumber: body.contactNumber,
        industryType: body.industryType,
        address: body.address,
        aboutCompany: body.aboutCompany,
        serviceOffered: body.serviceOffered,
        achievements: body.achievements || "",
        expiresAt,
        status: "pending",
      })
      .returning({ id: invitations.id });

    if (!newInvitation || newInvitation.length === 0) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Failed to create invitation",
        },
        BAD_REQUEST,
      );
    }

    // Build invitation URL using invitation ID
    const invitationUrl = `${FRONTEND_URL}/auth/accept-invitation?id=${newInvitation[0].id}`;

    // Update the invitation with the URL
    await db
      .update(invitations)
      .set({ invitationUrl })
      .where(eq(invitations.id, newInvitation[0].id));

    // Send invitation email
    try {
      await sendInvitationEmail(body.email, body.name, invitationUrl, {
        companyName: body.name,
        companyType: body.companyType,
        industryType: body.industryType,
      });
    } catch (emailErr) {
      console.error("Error sending invitation email:", emailErr);
      // Log but don't fail - invitation is still created
    }

    return c.json(
      {
        status_code: CREATED,
        message:
          "Invitation created successfully. Invitation email has been sent.",
        data: {
          invitationId: newInvitation[0].id,
          email: body.email,
          companyName: body.name,
          invitationExpiresAt: expiresAt,
          message: "Company admin should check their email for invitation link",
        },
      },
      CREATED,
    );
  } catch (err: any) {
    console.error("Error creating company invitation:", err);

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
    // Check if user exists and is a unit
    const existingUser = await db
      .select({
        id: userTable.id,
        role: userTable.role,
        banned: userTable.banned,
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

    // Deactivate the user account
    await db
      .update(userTable)
      .set({
        banned: true,
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
          banned: true,
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

//15. PATCH /admin/units/:id/activate - Activate Unit by Admin
export const activateUnit: AppRouteHandler<ActivateUnit> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    // Check if user exists
    const existingUser = await db
      .select({
        id: userTable.id,
        role: userTable.role,
        banned: userTable.banned,
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

    // Activate the user account
    await db
      .update(userTable)
      .set({
        banned: false,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, id));

    return c.json(
      {
        status_code: OK,
        message: "Unit activated successfully",
        data: {
          userId: id,
          banned: false,
          message: "Unit account has been activated",
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error activating unit:", err);
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
            avatarUrl: candidates.avatarUrl,
            createdAt: candidates.createdAt,
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
              avatarUrl: candidates.avatarUrl,
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
              applicationId: applications.id,
              applicationCreatedAt: applications.createdAt,
              skills: candidates.skills,
              interests: candidates.interests,
              profileSummary: candidates.profileSummary,
            })
            .from(applications)
            .innerJoin(candidates, eq(applications.userId, candidates.userId))
            .leftJoin(userTable, eq(candidates.userId, userTable.id))
            .innerJoin(
              internships,
              eq(applications.internshipId, internships.id),
            )
            .orderBy(desc(applications.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ count: count() }).from(applications),
        ]);

        const totalItems = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return c.json(
          {
            status_code: OK,
            message: "Applied candidates retrieved successfully",
            data: appliedCandidates,
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
              unitName: units.name,
              internshipDuration: internships.duration,
              internshipJobType: internships.jobType,
              applicationId: applications.id,
              applicationCreatedAt: applications.createdAt,
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
            data: hiredCandidates,
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
              applicationId: applications.id,
              applicationCreatedAt: applications.createdAt,
              skills: candidates.skills,
              interests: candidates.interests,
              profileSummary: candidates.profileSummary,
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
            data: shortlistedCandidates,
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

// GET /admin/candidates/:applicationId - Get Candidate Details by Application ID
export const getCandidateById: AppRouteHandler<GetCandidateById> = async (
  c,
) => {
  const { id: applicationId } = c.req.valid("param");

  try {
    const candidateData = await db
      .select({
        applicationId: applications.id,
        applicationStatus: applications.status,
        applicationCreatedAt: applications.createdAt,
        applicationUpdatedAt: applications.updatedAt,
        internshipName: internships.title,
        internshipId: internships.id,
        internshipsStatus: internships.status,
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
        userAccountStatus: userTable.accountDisabled,
      })
      .from(applications)
      .innerJoin(candidates, eq(applications.userId, candidates.userId))
      .leftJoin(userTable, eq(candidates.userId, userTable.id))
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!candidateData || candidateData.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Candidate or application not found",
        },
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
            avatarUrl: units.avatarUrl,
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
              avatarUrl: units.avatarUrl,
              accountStatus: userTable.accountDisabled,
              totalApplications: sql<number>`COUNT(DISTINCT ${applications.id})`,
              totalActiveInternships: sql<number>`COUNT(DISTINCT CASE WHEN ${internships.status} = 'active' THEN ${internships.id} END)`,
              internshipCreatedAt: sql<Date>`MAX(${internships.createdAt})`,
            })
            .from(units)
            .leftJoin(userTable, eq(units.userId, userTable.id))
            .leftJoin(internships, eq(units.userId, internships.createdBy))
            .leftJoin(
              applications,
              eq(internships.id, applications.internshipId),
            )
            .groupBy(
              units.userId,
              units.name,
              userTable.email,
              units.avatarUrl,
              userTable.accountDisabled,
            )
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
              data: activeUnits,
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

        // Otherwise return simple array of 10 with pagination
        const totalItems = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(totalItems / 10);

        return c.json(
          {
            status_code: OK,
            message: "Active units retrieved successfully",
            data: activeUnits,
            pagination: {
              currentPage: 1,
              totalPages,
              totalItems,
              itemsPerPage: 10,
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
            name: userTable.name,
            avatarUrl: candidates.avatarUrl,
            internshipName: internships.title,
            applicationStatus: applications.status,
            appliedAt: applications.createdAt,
            unitName: units.name,
            skills: candidates.skills,
            interests: candidates.interests,
            profileSummary: candidates.profileSummary,
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
            data: interviewData,
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

// 15. GET /admin/all - Get All Candidates and Units Data for Admin (combined array)
export const getAllCandidatesAndUnits: AppRouteHandler<
  GetAllCandidatesAndUnits
> = async (c) => {
  try {
    // Fetch candidates
    const candidatesData = await db
      .select({
        id: candidates.userId,
        name: userTable.name,
        createdAt: candidates.createdAt,
      })
      .from(candidates)
      .leftJoin(userTable, eq(candidates.userId, userTable.id))
      .then(
        (rows) => rows.map((row) => ({ ...row, type: "candidate" })), // Add type
      );

    // Fetch units
    const unitsData = await db
      .select({
        id: units.userId,
        name: units.name,
        createdAt: units.createdAt,
      })
      .from(units)
      .then(
        (rows) => rows.map((row) => ({ ...row, type: "unit" })), // Add type
      );

    // Combine both arrays
    const allData = [...candidatesData, ...unitsData];

    return c.json(
      {
        status_code: OK,
        message: "All candidates and units data retrieved successfully",
        data: allData,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching all candidates and units data:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 16. PATCH /admin/internships/:id/disable - Disable Internship by Admin
export const disableInternship: AppRouteHandler<DisableInternship> = async (
  c,
) => {
  const { id } = c.req.valid("param");

  try {
    // Check if internship exists
    const existingInternship = await db
      .select({ id: internships.id, status: internships.status })
      .from(internships)
      .where(eq(internships.id, id))
      .limit(1);

    if (existingInternship.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Internship not found",
        },
        NOT_FOUND,
      );
    }

    // Update internship status to closed
    await db
      .update(internships)
      .set({
        status: "closed",
        updatedAt: new Date(),
      })
      .where(eq(internships.id, id));

    return c.json(
      {
        status_code: OK,
        message: "Internship disabled successfully",
        data: {
          internshipId: id,
          status: "closed",
          message: "Internship posting has been closed",
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error disabling internship:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 17. PATCH /admin/internships/:id/enable - Enable Internship by Admin
export const enableInternship: AppRouteHandler<EnableInternship> = async (
  c,
) => {
  const { id } = c.req.valid("param");

  try {
    // Check if internship exists
    const existingInternship = await db
      .select({ id: internships.id, status: internships.status })
      .from(internships)
      .where(eq(internships.id, id))
      .limit(1);

    if (existingInternship.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Internship not found",
        },
        NOT_FOUND,
      );
    }

    // Update internship status to active
    await db
      .update(internships)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(internships.id, id));

    return c.json(
      {
        status_code: OK,
        message: "Internship enabled successfully",
        data: {
          internshipId: id,
          status: "active",
          message: "Internship posting has been reactivated",
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error enabling internship:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// 18. GET /admin/internships - Get All Internships with Pagination
export const getAllInternships: AppRouteHandler<GetAllInternships> = async (
  c,
) => {
  const { page = 1, limit = 10 } = c.req.valid("query");

  try {
    const offset = (page - 1) * limit;

    const [internshipsList, totalCountResult] = await Promise.all([
      db
        .select({
          internshipId: internships.id,
          name: internships.title,
          createdById: internships.createdBy,
          createdByName: units.name,
          totalApplications: count(applications.id),
          duration: internships.duration,
          createdAt: internships.createdAt,
          status: internships.status,
        })
        .from(internships)
        .leftJoin(units, eq(internships.createdBy, units.userId))
        .leftJoin(applications, eq(applications.internshipId, internships.id))
        .groupBy(
          internships.id,
          internships.title,
          internships.createdBy,
          units.name,
          internships.duration,
          internships.createdAt,
          internships.status,
        )
        .orderBy(desc(internships.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(internships),
    ]);

    const totalItems = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    return c.json(
      {
        status_code: OK,
        message: "All internships retrieved successfully",
        data: internshipsList,
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
    console.error("Error fetching internships:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
