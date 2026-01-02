import { and, count, desc, eq, gte } from "drizzle-orm";
import Fuse from "fuse.js";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { internships } from "@/db/schema/internship.schema";
import { interviews } from "@/db/schema/interview.schema";
import { units } from "@/db/schema/unit.schema";
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

type InternshipWithMetadata = {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  payment: string | null;
  status: "active" | "closed" | "draft";
  closingDate: string | Date | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  isPaid: boolean | null;
  minAgeRequired: string | null;
  jobType: "part_time" | "full_time" | "both" | null;
  benefits: string[] | null;
  skillsRequired: string[] | null;
  responsibilities: string[] | null;
  language: string[] | null;
  createdBy: {
    userId: string | null;
    name: string | null;
    address: string | null;
    phone: string | null;
    websiteUrl: string | null;
    description: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    location: string | null;
  };
};

type RawInternshipQuery = {
  id: string;
  createdBy: string;
  title: string;
  description: string | null;
  duration: string | null;
  payment: string | null;
  status: "active" | "closed" | "draft";
  closingDate: string | Date | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  isPaid: boolean | null;
  minAgeRequired: string | null;
  jobType: "part_time" | "full_time" | "both" | null;
  benefits: string[] | null;
  skillsRequired: string[] | null;
  responsibilities: string[] | null;
  language: string[] | null;
  unitUserId: string | null;
  unitName: string | null;
  unitAddress: string | null;
  unitPhone: string | null;
  unitWebsiteUrl: string | null;
  unitDescription: string | null;
  unitAvatarUrl: string | null;
  unitBannerUrl: string | null;
  unitLocation: string | null;
};

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Returns the select object for internship queries with unit metadata
 */
const getInternshipSelectQuery = () => ({
  id: internships.id,
  createdBy: internships.createdBy,
  title: internships.title,
  description: internships.description,
  duration: internships.duration,
  payment: internships.payment,
  status: internships.status,
  closingDate: internships.closingDate,
  createdAt: internships.createdAt,
  updatedAt: internships.updatedAt,
  isPaid: internships.isPaid,
  minAgeRequired: internships.minAgeRequired,
  jobType: internships.jobType,
  benefits: internships.benefits,
  skillsRequired: internships.skillsRequired,
  responsibilities: internships.responsibilities,
  language: internships.language,
  unitUserId: units.userId,
  unitName: units.name,
  unitAddress: units.address,
  unitPhone: units.phone,
  unitWebsiteUrl: units.websiteUrl,
  unitDescription: units.description,
  unitAvatarUrl: units.avatarUrl,
  unitBannerUrl: units.bannerUrl,
  unitLocation: units.location,
});

/**
 * Transforms raw database result into InternshipWithMetadata
 */
const transformToInternshipWithMetadata = (
  raw: RawInternshipQuery,
): InternshipWithMetadata => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  duration: raw.duration,
  payment: raw.payment,
  status: raw.status,
  closingDate: raw.closingDate,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
  isPaid: raw.isPaid,
  minAgeRequired: raw.minAgeRequired,
  jobType: raw.jobType,
  benefits: raw.benefits,
  skillsRequired: raw.skillsRequired,
  responsibilities: raw.responsibilities,
  language: raw.language,
  createdBy: {
    userId: raw.unitUserId,
    name: raw.unitName,
    address: raw.unitAddress,
    phone: raw.unitPhone,
    websiteUrl: raw.unitWebsiteUrl,
    description: raw.unitDescription,
    avatarUrl: raw.unitAvatarUrl,
    bannerUrl: raw.unitBannerUrl,
    location: raw.unitLocation,
  },
});

/**
 * Fetches internships with unit metadata based on filter condition
 */
const fetchInternshipsWithMetadata = async (
  whereCondition?: any,
): Promise<InternshipWithMetadata[]> => {
  const query = db
    .select(getInternshipSelectQuery())
    .from(internships)
    .leftJoin(units, eq(internships.createdBy, units.userId))
    .orderBy(desc(internships.createdAt));

  const rawList = whereCondition
    ? await query.where(whereCondition)
    : await query;

  return rawList.map(transformToInternshipWithMetadata);
};

/**
 * Fetches a single internship by ID with metadata
 */
const fetchInternshipById = async (
  id: string,
  whereCondition: any,
): Promise<InternshipWithMetadata | null> => {
  const [result] = await db
    .select(getInternshipSelectQuery())
    .from(internships)
    .leftJoin(units, eq(internships.createdBy, units.userId))
    .where(whereCondition)
    .limit(1);

  return result ? transformToInternshipWithMetadata(result) : null;
};

// ============================================================================
// BUSINESS LOGIC HELPERS
// ============================================================================

/**
 * Extracts and normalizes keywords from user profile
 */
const extractProfileKeywords = (userProfile: any): string[] => {
  const userSkills = userProfile.skills || [];
  const userInterests = userProfile.interests || [];
  const userCourses = userProfile.course || [];
  const userProjects = userProfile.projects || [];
  const projectSkills = userProjects.flatMap((p: any) => p.skills || []);

  const normalize = (keyword: string): string =>
    keyword
      .toLowerCase()
      .replace(/web dev/g, "web development")
      .replace(/full stack/g, "full-stack")
      .replace(/programming/g, "software development")
      .replace(/research & emerging fields/g, "emerging technologies research")
      .trim();

  return [
    ...new Set(
      [...userSkills, ...userInterests, ...userCourses, ...projectSkills]
        .map(normalize)
        .filter(Boolean),
    ),
  ];
};

/**
 * Creates searchable text corpus for an internship
 */
const createInternshipCorpus = (internship: InternshipWithMetadata) => ({
  ...internship,
  combinedText: [
    internship.title,
    internship.description,
    ...(Array.isArray(internship.skillsRequired)
      ? internship.skillsRequired
      : []),
    ...(Array.isArray(internship.responsibilities)
      ? internship.responsibilities
      : []),
    ...(Array.isArray(internship.benefits) ? internship.benefits : []),
  ]
    .join(" ")
    .toLowerCase(),
});

/**
 * Matches internships to user profile keywords using fuzzy search
 */
const matchInternshipsToKeywords = (
  internships: InternshipWithMetadata[],
  keywords: string[],
  options = { threshold: 0.6, maxResults: 10 },
) => {
  const corpus = internships.map(createInternshipCorpus);

  // Tokenize keywords - split multi-word keywords into individual words
  // "business & entrepreneurship" becomes ["business", "entrepreneurship"]
  const expandedKeywords = keywords.flatMap((keyword) =>
    keyword
      .split(/[\s&,]+/) // Split on spaces, ampersands, and commas
      .filter((word) => word.length > 2) // Filter out very short words
      .map((word) => word.toLowerCase().trim()),
  );

  // Remove duplicates
  const uniqueKeywords = [...new Set(expandedKeywords)];

  const fuse = new Fuse(corpus, {
    includeScore: true,
    threshold: options.threshold, // 0 = exact match, 1 = match anything
    keys: ["combinedText"],
    ignoreLocation: true, // Don't care where in the text the match is
    minMatchCharLength: 3, // Minimum length of match
  });

  type MatchedInternship = (typeof corpus)[number] & {
    matchScore: number;
    matchedKeywords: string[];
  };

  const matchedInternships: MatchedInternship[] = [];

  uniqueKeywords.forEach((keyword) => {
    const results = fuse.search(keyword);

    results.forEach((r) => {
      const existing = matchedInternships.find((m) => m.id === r.item.id);
      // Better scoring: score is 0-1 where 0 is perfect match
      // Convert to 0-10 scale where higher is better
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

  return matchedInternships
    .filter((i) => i.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, options.maxResults);
};

/**
 * Gets the start of the current month
 */
const getStartOfMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export const getUnitStats: AppRouteHandler<GetUnitStats> = async (c) => {
  const user = c.get("user");

  try {
    const startOfMonth = getStartOfMonth();

    // Execute all stat queries in parallel
    const [
      totalInternshipsResult,
      totalApplicationsResult,
      totalInterviewsResult,
      hiredThisMonthResult,
    ] = await Promise.all([
      // Total internships created by this unit
      db
        .select({ count: count() })
        .from(internships)
        .where(eq(internships.createdBy, user.id)),

      // Total applications to unit's internships
      db
        .select({ count: count() })
        .from(applications)
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(eq(internships.createdBy, user.id)),

      // Total interviews scheduled for unit's internships
      db
        .select({ count: count() })
        .from(interviews)
        .innerJoin(applications, eq(interviews.applicationId, applications.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(eq(internships.createdBy, user.id)),

      // Hired this month
      db
        .select({ count: count() })
        .from(applications)
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(
          and(
            eq(internships.createdBy, user.id),
            eq(applications.status, "hired"),
            gte(applications.updatedAt, startOfMonth),
          ),
        ),
    ]);

    const now = new Date();

    return c.json(
      {
        status_code: OK,
        message: "Statistics retrieved successfully",
        data: {
          totalInternships: totalInternshipsResult[0]?.count || 0,
          totalApplications: totalApplicationsResult[0]?.count || 0,
          totalInterviews: totalInterviewsResult[0]?.count || 0,
          hiredThisMonth: hiredThisMonthResult[0]?.count || 0,
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

export const getInternships: AppRouteHandler<GetInternships> = async (c) => {
  const user = c.get("user");

  try {
    let internshipList: InternshipWithMetadata[];

    if (user.role === "unit") {
      // Units see only their created internships
      internshipList = await fetchInternshipsWithMetadata(
        eq(internships.createdBy, user.id),
      );
    } else if (user.role === "candidate") {
      // Candidates see all active internships
      internshipList = await fetchInternshipsWithMetadata(
        eq(internships.status, "active"),
      );
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

export const getInternshipById: AppRouteHandler<GetInternshipById> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  try {
    // Determine where condition based on user role
    const whereCondition =
      user.role === "unit"
        ? and(eq(internships.id, id), eq(internships.createdBy, user.id))
        : user.role === "candidate"
          ? and(eq(internships.id, id), eq(internships.status, "active"))
          : null;

    if (!whereCondition) {
      return c.json(
        { status_code: FORBIDDEN, message: "Invalid role" },
        FORBIDDEN,
      );
    }

    const internship = await fetchInternshipById(id, whereCondition);

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

export const createInternship: AppRouteHandler<CreateInternship> = async (
  c,
) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  try {
    const [newInternship] = await db
      .insert(internships)
      .values({
        ...body,
        createdBy: user.id,
      })
      .returning();

    // Fetch created internship with metadata
    const internship = await fetchInternshipById(
      newInternship.id,
      eq(internships.id, newInternship.id),
    );

    if (!internship) {
      throw new Error("Failed to fetch created internship");
    }

    return c.json(
      {
        status_code: CREATED,
        message: "Internship created successfully",
        data: internship,
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

export const updateInternship: AppRouteHandler<UpdateInternship> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  try {
    const [updatedInternship] = await db
      .update(internships)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(and(eq(internships.id, id), eq(internships.createdBy, user.id)))
      .returning();

    if (!updatedInternship) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    // Fetch updated internship with metadata
    const internship = await fetchInternshipById(id, eq(internships.id, id));

    if (!internship) {
      throw new Error("Failed to fetch updated internship");
    }

    return c.json(
      {
        status_code: OK,
        message: "Internship updated successfully",
        data: internship,
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

export const getRecommendedInternships: AppRouteHandler<
  GetRecommendedInternships
> = async (c) => {
  const user = c.get("user");

  try {
    // Fetch user profile
    const [userProfile] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.userId, user.id))
      .limit(1);

    if (!userProfile) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message:
            "User profile not found. Please complete your profile first.",
        },
        NOT_FOUND,
      );
    }

    // Extract keywords from profile
    const profileKeywords = extractProfileKeywords(userProfile);

    if (profileKeywords.length === 0) {
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

    // Fetch active internships with metadata
    const activeInternships = await fetchInternshipsWithMetadata(
      eq(internships.status, "active"),
    );

    // Match internships to user profile
    const matchedInternships = matchInternshipsToKeywords(
      activeInternships,
      profileKeywords,
    );

    return c.json(
      {
        status_code: OK,
        message: "Recommended internships retrieved successfully",
        data: {
          internships: matchedInternships,
          totalMatches: matchedInternships.length,
          profileKeywords,
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

export const deleteInternship: AppRouteHandler<DeleteInternship> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  try {
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
