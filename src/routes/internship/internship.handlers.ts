import { and, count, desc, eq, gte } from "drizzle-orm";
import Fuse from "fuse.js";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { internships } from "@/db/schema/internship.schema";
import { interviews } from "@/db/schema/interview.schema";
import {
  CREATED,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type {
  CreateInternship,
  DeleteInternship,
  GetInternshipById,
  GetInternships,
  GetRecommendedInternships,
  GetUnitStats,
  UpdateInternship,
} from "./internship.routes";

// GET /internships - Get all internships (for candidates) or created internships (for units)
export const getInternships: AppRouteHandler<GetInternships> = async (c) => {
  const user = c.get("user");

  try {
    let internshipList;

    if (user.role === "unit") {
      // Units see only their created internships
      internshipList = await db
        .select()
        .from(internships)
        .where(eq(internships.createdBy, user.id))
        .orderBy(desc(internships.createdAt));
    } else if (user.role === "candidate") {
      // Candidates see all active internships
      internshipList = await db
        .select()
        .from(internships)
        .where(eq(internships.status, "active"))
        .orderBy(desc(internships.createdAt));
    } else {
      return c.json(
        { status_code: FORBIDDEN, message: "Invalid role" },
        FORBIDDEN,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Internships retrieved successfully",
        data: internshipList,
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

// GET /internships/:id - Get specific internship by ID
export const getInternshipById: AppRouteHandler<GetInternshipById> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  try {
    // OPTIMIZED: Single query with role-based filtering
    let whereCondition;

    if (user.role === "unit") {
      // Units can only see their own internships
      whereCondition = and(
        eq(internships.id, id),
        eq(internships.createdBy, user.id),
      );
    } else if (user.role === "candidate") {
      // Candidates can only see active internships
      whereCondition = and(
        eq(internships.id, id),
        eq(internships.status, "active"),
      );
    } else {
      return c.json(
        { status_code: FORBIDDEN, message: "Invalid role" },
        FORBIDDEN,
      );
    }

    const [internship] = await db
      .select()
      .from(internships)
      .where(whereCondition)
      .limit(1);

    if (!internship) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Internship retrieved successfully",
        data: internship,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching internship:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// POST /internships - Create new internship (unit only)
export const createInternship: AppRouteHandler<CreateInternship> = async (
  c,
) => {
  const user = c.get("user");

  try {
    const data = c.req.valid("json");

    // Prepare insert payload; keep closingDate as string (schema expects string)
    const internshipData = {
      ...data,
      createdBy: user.id,
      closingDate: data.closingDate ? data.closingDate : undefined,
    } as typeof internships.$inferInsert;

    const [newInternship] = await db
      .insert(internships)
      .values(internshipData)
      .returning();

    return c.json(
      {
        status_code: CREATED,
        message: "Internship created successfully",
        data: newInternship,
      },
      CREATED,
    );
  } catch (err) {
    console.error("Error creating internship:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// PUT /internships/:id - Update internship (unit only, own internships)
export const updateInternship: AppRouteHandler<UpdateInternship> = async (
  c,
) => {
  const user = c.get("user");

  if (user.role !== "unit") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only units can update internships",
      },
      FORBIDDEN,
    );
  }

  const { id } = c.req.valid("param");

  try {
    const data = c.req.valid("json");

    // Convert closingDate string to Date if provided
    const updateData = {
      ...data,
      closingDate: data.closingDate ? data.closingDate : undefined,
    } as typeof internships.$inferInsert;

    // OPTIMIZED: Single update query with ownership check
    const [updatedInternship] = await db
      .update(internships)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(internships.id, id), eq(internships.createdBy, user.id)))
      .returning();

    if (!updatedInternship) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Internship updated successfully",
        data: updatedInternship,
      },
      OK,
    );
  } catch (err) {
    console.error("Error updating internship:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /internships/recommended - Get recommended internships based on user profile
export const getRecommendedInternships: AppRouteHandler<
  GetRecommendedInternships
> = async (c) => {
  const user = c.get("user");

  try {
    const profile = await db
      .select()
      .from(candidates)
      .where(eq(candidates.userId, user.id))
      .limit(1);

    if (!profile || profile.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message:
            "User profile not found. Please complete your profile first.",
        },
        NOT_FOUND,
      );
    }

    const userProfileData = profile[0];

    const userSkills = userProfileData.skills || [];
    const userInterests = userProfileData.interests || [];
    const userCourses = userProfileData.course || [];
    const userProjects = userProfileData.projects || [];

    const projectSkills = userProjects.flatMap((p: any) => p.skills || []);

    const clean = (k: string) =>
      k
        .toLowerCase()
        .replace(/web dev/g, "web development")
        .replace(/full stack/g, "full-stack")
        .replace(/programming/g, "software development")
        .replace(
          /research & emerging fields/g,
          "emerging technologies research",
        )
        .trim();

    const uniqueKeywords = [
      ...new Set(
        [...userSkills, ...userInterests, ...userCourses, ...projectSkills]
          .map(clean)
          .filter(Boolean),
      ),
    ];

    if (uniqueKeywords.length === 0) {
      return c.json(
        {
          status_code: OK,
          message:
            "No profile data available for recommendations. Please add skills, interests, or courses to your profile.",
          data: {
            internships: [],
            totalMatches: 0,
            profileKeywords: [],
          },
        },
        OK,
      );
    }

    const activeInternships = await db
      .select()
      .from(internships)
      .where(eq(internships.status, "active"))
      .orderBy(desc(internships.createdAt));

    // Prepare internship search corpus
    const internshipCorpus = activeInternships.map((i) => ({
      ...i,
      combinedText: [
        i.title,
        i.description,
        ...(i.skillsRequired || []),
        ...(i.responsibilities || []),
        ...(i.benefits || []),
      ]
        .join(" ")
        .toLowerCase(),
    }));

    const fuse = new Fuse(internshipCorpus, {
      includeScore: true,
      threshold: 0.4, // 0 = exact match, 1 = extremely fuzzy
      keys: ["combinedText"],
    });

    type MatchedInternship = (typeof internshipCorpus)[number] & {
      matchScore: number;
      matchedKeywords: string[];
    };

    const matchedInternships: MatchedInternship[] = [];

    uniqueKeywords.forEach((keyword) => {
      const results = fuse.search(keyword);

      results.forEach((r) => {
        const existing = matchedInternships.find((m) => m.id === r.item.id);
        const scoreBoost = Math.round((1 - r.score!) * 10);

        if (existing) {
          existing.matchScore += scoreBoost;
          if (!existing.matchedKeywords.includes(keyword)) {
            existing.matchedKeywords.push(keyword);
          }
        } else {
          matchedInternships.push({
            ...r.item,
            matchScore: scoreBoost,
            matchedKeywords: [keyword],
          });
        }
      });
    });

    const sorted = matchedInternships
      .filter((i) => i.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);

    return c.json(
      {
        status_code: OK,
        message: "Recommended internships retrieved successfully",
        data: {
          internships: sorted,
          totalMatches: sorted.length,
          profileKeywords: uniqueKeywords,
        },
      },
      OK,
    );
  } catch (error) {
    console.error("Error fetching recommended internships:", error);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /internships/:id - Delete internship (unit only, own internships)
export const deleteInternship: AppRouteHandler<DeleteInternship> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  try {
    // OPTIMIZED: Single delete query with ownership check
    const [deletedInternship] = await db
      .delete(internships)
      .where(and(eq(internships.id, id), eq(internships.createdBy, user.id)))
      .returning();

    if (!deletedInternship) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Internship deleted successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error deleting internship:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const getUnitStats: AppRouteHandler<GetUnitStats> = async (c) => {
  const user = c.get("user");

  try {
    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total internships created by this unit
    const totalInternshipsResult = await db
      .select({ count: count() })
      .from(internships)
      .where(eq(internships.createdBy, user.id));

    const totalInternships = totalInternshipsResult[0]?.count || 0;

    // Total applications to unit's internships
    const totalApplicationsResult = await db
      .select({ count: count() })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .where(eq(internships.createdBy, user.id));

    const totalApplications = totalApplicationsResult[0]?.count || 0;

    // Total interviews scheduled for unit's internships
    const totalInterviewsResult = await db
      .select({ count: count() })
      .from(interviews)
      .innerJoin(applications, eq(interviews.applicationId, applications.id))
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .where(eq(internships.createdBy, user.id));

    const totalInterviews = totalInterviewsResult[0]?.count || 0;

    // Hired this month (applications with status 'hired' and updated this month)
    const hiredThisMonthResult = await db
      .select({ count: count() })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .where(
        and(
          eq(internships.createdBy, user.id),
          eq(applications.status, "hired"),
          gte(applications.updatedAt, startOfMonth),
        ),
      );

    const hiredThisMonth = hiredThisMonthResult[0]?.count || 0;

    return c.json(
      {
        status_code: OK,
        message: "Statistics retrieved successfully",
        data: {
          totalInternships,
          totalApplications,
          totalInterviews,
          hiredThisMonth,
          period: {
            month: now.toLocaleString("default", { month: "long" }),
            year: now.getFullYear(),
          },
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching unit statistics:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
