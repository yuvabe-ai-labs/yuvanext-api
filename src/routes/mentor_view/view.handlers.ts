import { applications } from "@/db/schema/application.schema";
import { internships } from "@/db/schema/internship.schema";
import { units } from "@/db/schema/unit.schema";
import {
  aliasedTable,
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  sql,
} from "drizzle-orm";
import {
  GetMentorAcceptedCandidates,
  GetMentorAcceptedCandidatesApplications,
  GetMentorDashboard,
  GetMentorHiredCandidates,
  GetMentorUnitCandidates,
  GetMentorUnitProfile,
  GetMentorUnits,
} from "./view.routes";
import { AppRouteHandler } from "@/types/app.types";
import { mentorshipRequests } from "@/db/schema/mentorship-requests.schema";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import db from "@/db";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

/**
 * GET /mentor/candidates
 *
 * Returns a paginated list of candidates whose request this mentor ACCEPTED.
 * search → filters by candidate name (case-insensitive)
 */
export const getMentorAcceptedCandidates: AppRouteHandler<
  GetMentorAcceptedCandidates
> = async (c) => {
  const user = c.get("user");
  const { search, page = 1, limit = 10 } = c.req.valid("query");

  try {
    const offset = (page - 1) * limit;

    const baseConditions = [
      eq(mentorshipRequests.mentorId, user.id),
      eq(mentorshipRequests.status, "accepted"),
    ];

    const allConditions = search
      ? and(...baseConditions, ilike(userTable.name, `%${search}%`))
      : and(...baseConditions);

    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          requestId: mentorshipRequests.id,
          message: mentorshipRequests.message,
          requestedAt: mentorshipRequests.createdAt,
          acceptedAt: mentorshipRequests.updatedAt, // updatedAt = when status last changed → i.e. when accepted
          candidateUserId: candidates.userId,
          candidateName: userTable.name,
          candidateEmail: userTable.email,
          candidateAvatarUrl: candidates.avatarUrl,
          candidateProfileSummary: candidates.profileSummary,
          candidateSkills: candidates.skills,
          candidateExperienceLevel: candidates.experienceLevel,
        })
        .from(mentorshipRequests)
        .innerJoin(
          candidates,
          eq(mentorshipRequests.candidateId, candidates.userId),
        )
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(allConditions)
        .orderBy(desc(mentorshipRequests.updatedAt)) // most recently accepted first
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .innerJoin(
          candidates,
          eq(mentorshipRequests.candidateId, candidates.userId),
        )
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    const data = rows.map((row) => ({
      requestId: row.requestId,
      message: row.message,
      requestedAt: row.requestedAt,
      acceptedAt: row.acceptedAt,
      candidate: {
        userId: row.candidateUserId,
        name: row.candidateName,
        email: row.candidateEmail,
        avatarUrl: row.candidateAvatarUrl,
        profileSummary: row.candidateProfileSummary,
        skills: row.candidateSkills,
        experienceLevel: row.candidateExperienceLevel,
      },
    }));

    return c.json(
      {
        status_code: OK,
        message: "Accepted candidates retrieved successfully",
        data,
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
    console.error("Error fetching accepted candidates:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /mentor/accepted-candidates/applications
 *
 * Strategy:
 *  1. Fetch all candidateIds this mentor has accepted (sub-query / in-memory).
 *     This is typically a small set so it's cheap.
 *  2. If none, return an empty paginated result immediately.
 *  3. Join applications → candidates → user (candidate) → internships → units → user (unit).
 *     Filter to only the accepted candidateIds.
 *  4. Apply optional search (candidate name OR internship title) and status filter.
 *  5. Paginate and return.
 */
export const getMentorAcceptedCandidatesApplications: AppRouteHandler<
  GetMentorAcceptedCandidatesApplications
> = async (c) => {
  const mentor = c.get("user");
  const { search, status, page = 1, limit = 10 } = c.req.valid("query");

  try {
    // ── Step 1: get all accepted candidateIds for this mentor ─────────────────
    const acceptedRows = await db
      .select({ candidateId: mentorshipRequests.candidateId })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.status, "accepted"),
        ),
      );

    const acceptedCandidateIds = acceptedRows.map((r) => r.candidateId);

    // ── Step 2: early-return if mentor has no accepted candidates ─────────────
    if (acceptedCandidateIds.length === 0) {
      return c.json(
        {
          status_code: OK,
          message:
            "You have not accepted any candidates yet. Accept mentorship requests to see their applications here.",
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
          },
        },
        OK,
      );
    }

    // ── Step 3: alias unit's user row to avoid column clash ───────────────────
    const unitUser = aliasedTable(userTable, "unit_user");

    // ── Step 4: build conditions ──────────────────────────────────────────────
    const offset = (page - 1) * limit;

    const baseConditions = [inArray(applications.userId, acceptedCandidateIds)];

    if (status) {
      baseConditions.push(eq(applications.status, status));
    }

    // search matches candidate name OR internship title
    const searchCondition = search
      ? sql`(${ilike(userTable.name, `%${search}%`)} OR ${ilike(internships.title, `%${search}%`)})`
      : undefined;

    const allConditions = searchCondition
      ? and(...baseConditions, searchCondition)
      : and(...baseConditions);

    // ── Step 5: count + data in parallel ─────────────────────────────────────
    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          // Application
          applicationId: applications.id,
          appStatus: applications.status,
          appliedAt: applications.createdAt,
          updatedAt: applications.updatedAt,
          profileScore: applications.profileScore,
          candidateOfferDecision: applications.candidateOfferDecision,
          unitOfferDecision: applications.unitOfferDecision,
          // Candidate snapshot (from candidates + user tables)
          candidateUserId: candidates.userId,
          candidateName: userTable.name,
          candidateEmail: userTable.email,
          candidateAvatarUrl: candidates.avatarUrl,
          candidateProfileSummary: candidates.profileSummary,
          candidateSkills: candidates.skills,
          candidateExperienceLevel: candidates.experienceLevel,
          // Internship
          internshipId: internships.id,
          internshipTitle: internships.title,
          internshipDescription: internships.description,
          internshipDuration: internships.duration,
          internshipJobType: internships.jobType,
          internshipIsPaid: internships.isPaid,
          internshipPayment: internships.payment,
          internshipStatus: internships.status,
          internshipClosingDate: internships.closingDate,
          internshipSkillsRequired: internships.skillsRequired,
          // Unit (via aliased user row)
          unitUserId: units.userId,
          unitName: unitUser.name,
          unitEmail: unitUser.email,
          unitImage: unitUser.image,
        })
        .from(applications)
        .innerJoin(candidates, eq(applications.userId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(units, eq(internships.createdBy, units.userId))
        .innerJoin(unitUser, eq(units.userId, unitUser.id))
        .where(allConditions)
        .orderBy(desc(applications.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(applications)
        .innerJoin(candidates, eq(applications.userId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(units, eq(internships.createdBy, units.userId))
        .innerJoin(unitUser, eq(units.userId, unitUser.id))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    const data = rows.map((row) => ({
      applicationId: row.applicationId,
      status: row.appStatus,
      appliedAt: row.appliedAt,
      updatedAt: row.updatedAt,
      candidate: {
        userId: row.candidateUserId,
        name: row.candidateName,
        email: row.candidateEmail,
        avatarUrl: row.candidateAvatarUrl,
        profileSummary: row.candidateProfileSummary,
        skills: row.candidateSkills,
        experienceLevel: row.candidateExperienceLevel,
      },
      internship: {
        title: row.internshipTitle,
        unit: {
          userId: row.unitUserId,
          name: row.unitName,
          email: row.unitEmail,
          image: row.unitImage,
        },
      },
    }));

    const message =
      data.length === 0
        ? "Your candidates have not applied to any internship yet."
        : "Applications retrieved successfully.";

    return c.json(
      {
        status_code: OK,
        message,
        data,
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
    console.error(
      "Error fetching accepted candidates applications for mentor:",
      err,
    );
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /mentor/units
 *
 * Strategy:
 *  1. Get all accepted candidateIds for this mentor.
 *  2. If none → early return.
 *  3. Join applications → internships → units → user (for email/image)
 *     grouped by unit, filtered to only the accepted candidates.
 *  4. Apply optional search on unit name, paginate and return.
 */
export const getMentorUnits: AppRouteHandler<GetMentorUnits> = async (c) => {
  const mentor = c.get("user");
  const { search, page = 1, limit = 10 } = c.req.valid("query");

  try {
    // Step 1: get all accepted candidateIds
    const acceptedRows = await db
      .select({ candidateId: mentorshipRequests.candidateId })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.status, "accepted"),
        ),
      );

    const acceptedCandidateIds = acceptedRows.map((r) => r.candidateId);

    // Step 2: early return
    if (acceptedCandidateIds.length === 0) {
      return c.json(
        {
          status_code: OK,
          message:
            "You have not accepted any candidates yet. Accept mentorship requests to see units here.",
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
          },
        },
        OK,
      );
    }

    const offset = (page - 1) * limit;

    // Step 3: build conditions — filter to applications from accepted candidates
    const baseConditions = [inArray(applications.userId, acceptedCandidateIds)];

    const allConditions = search
      ? and(...baseConditions, ilike(units.name, `%${search}%`))
      : and(...baseConditions);

    // Step 4: count + data in parallel
    // We GROUP BY unit to deduplicate and get applicationCount per unit
    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          userId: units.userId,
          name: units.name,
          type: units.type,
          industry: units.industry,
          location: units.location,
          avatarUrl: units.avatarUrl,
          description: units.description,
          isAurovillian: units.isAurovillian,
          applicationCount: count(applications.id),
        })
        .from(applications)
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(units, eq(internships.createdBy, units.userId))
        .where(allConditions)
        .groupBy(
          units.userId,
          units.name,
          units.type,
          units.industry,
          units.location,
          units.avatarUrl,
          units.description,
          units.isAurovillian,
        )
        .orderBy(desc(count(applications.id))) // units with most applications first
        .limit(limit)
        .offset(offset),

      // Count distinct units (not rows) for pagination
      db
        .select({
          count: sql<number>`cast(count(distinct ${units.userId}) as int)`,
        })
        .from(applications)
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(units, eq(internships.createdBy, units.userId))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    const message =
      rows.length === 0
        ? "Your accepted candidates have not applied to any unit yet."
        : "Units retrieved successfully.";

    return c.json(
      {
        status_code: OK,
        message,
        data: rows,
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
    console.error("Error fetching mentor units:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /mentor/units/:unitId
 *
 * Guard: at least one of this mentor's accepted candidates must have applied
 * to an internship from this unit — otherwise return 404.
 */
export const getMentorUnitProfile: AppRouteHandler<
  GetMentorUnitProfile
> = async (c) => {
  const mentor = c.get("user");
  const { unitId } = c.req.valid("param");

  try {
    // Step 1: get accepted candidateIds
    const acceptedRows = await db
      .select({ candidateId: mentorshipRequests.candidateId })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.status, "accepted"),
        ),
      );

    const acceptedCandidateIds = acceptedRows.map((r) => r.candidateId);

    if (acceptedCandidateIds.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Unit not found or not accessible.",
        },
        NOT_FOUND,
      );
    }

    // Step 2: guard — verify at least one accepted candidate applied to this unit
    const [access] = await db
      .select({ applicationId: applications.id })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .where(
        and(
          inArray(applications.userId, acceptedCandidateIds),
          eq(internships.createdBy, unitId),
        ),
      )
      .limit(1);

    if (!access) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Unit not found or not accessible.",
        },
        NOT_FOUND,
      );
    }

    // Step 3: fetch the full unit profile, joining user table for email + image
    const unitUser = aliasedTable(userTable, "unit_user");

    const [unit] = await db
      .select({
        userId: units.userId,
        name: units.name,
        type: units.type,
        phone: units.phone,
        address: units.address,
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
        location: units.location,
        focusAreas: units.focusAreas,
        skillsOffered: units.skillsOffered,
        opportunitiesOffered: units.opportunitiesOffered,
        socialLinks: units.socialLinks,
        email: unitUser.email,
        image: unitUser.image,
      })
      .from(units)
      .innerJoin(unitUser, eq(units.userId, unitUser.id))
      .where(eq(units.userId, unitId))
      .limit(1);

    if (!unit) {
      return c.json(
        { status_code: NOT_FOUND, message: "Unit not found." },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Unit profile retrieved successfully.",
        data: unit,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching mentor unit profile:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// ─── ADD THIS to view.handlers.ts ────────────────────────────────────────────
// Add to route type imports:
//   GetMentorDashboard

/**
 * GET /mentor/dashboard
 *
 * Strategy:
 *  1. Fetch all accepted candidates for this mentor (paginated by candidate).
 *  2. If none → early return with clear message.
 *  3. Fetch ALL applications for those candidates in one query
 *     (joined with internships + units), then group them in-memory by candidateId.
 *  4. Apply search filter (candidate name OR internship title) and status filter.
 *  5. Merge: each candidate row gets its own applications[] array nested inside.
 *  6. Return totalAcceptedCandidates + totalApplications as summary counts.
 */
export const getMentorDashboard: AppRouteHandler<GetMentorDashboard> = async (
  c,
) => {
  const mentor = c.get("user");
  const { search, status, page = 1, limit = 10 } = c.req.valid("query");

  try {
    const offset = (page - 1) * limit;

    // Step 1: fetch accepted candidates for this mentor (paginated)
    // search on candidate name is applied here
    const candidateConditions = [
      eq(mentorshipRequests.mentorId, mentor.id),
      eq(mentorshipRequests.status, "accepted"),
    ];

    const candidateNameCondition = search
      ? ilike(userTable.name, `%${search}%`)
      : undefined;

    const candidateWhereClause = candidateNameCondition
      ? and(...candidateConditions, candidateNameCondition)
      : and(...candidateConditions);

    const [candidateRows, candidateTotalResult] = await Promise.all([
      db
        .select({
          requestId: mentorshipRequests.id,
          acceptedAt: mentorshipRequests.updatedAt,
          candidateUserId: candidates.userId,
          candidateName: userTable.name,
          candidateEmail: userTable.email,
          candidateAvatarUrl: candidates.avatarUrl,
          candidateProfileSummary: candidates.profileSummary,
          candidateSkills: candidates.skills,
          candidateExperienceLevel: candidates.experienceLevel,
        })
        .from(mentorshipRequests)
        .innerJoin(
          candidates,
          eq(mentorshipRequests.candidateId, candidates.userId),
        )
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(candidateWhereClause)
        .orderBy(desc(mentorshipRequests.updatedAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .innerJoin(
          candidates,
          eq(mentorshipRequests.candidateId, candidates.userId),
        )
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .where(candidateWhereClause),
    ]);

    // Step 2: early return if no accepted candidates
    if (candidateRows.length === 0) {
      return c.json(
        {
          status_code: OK,
          message:
            "You have not accepted any candidates yet. Accept mentorship requests to see them here.",
          data: {
            totalAcceptedCandidates: 0,
            totalApplications: 0,
            candidates: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
            },
          },
        },
        OK,
      );
    }

    const acceptedCandidateIds = candidateRows.map((r) => r.candidateUserId);

    // Step 3: fetch all applications for these candidates in one query
    const unitUser = aliasedTable(userTable, "unit_user");

    const appConditions = [inArray(applications.userId, acceptedCandidateIds)];

    if (status) {
      appConditions.push(eq(applications.status, status));
    }

    // search on internship title (in addition to candidate name already filtered above)
    const internshipTitleCondition = search
      ? ilike(internships.title, `%${search}%`)
      : undefined;

    // For applications: match if internship title matches search
    // (candidates already filtered by name in step 1)
    const appWhereClause = internshipTitleCondition
      ? and(...appConditions, internshipTitleCondition)
      : and(...appConditions);

    const applicationRows = await db
      .select({
        applicationId: applications.id,
        candidateId: applications.userId,
        appStatus: applications.status,
        appliedAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        profileScore: applications.profileScore,
        candidateOfferDecision: applications.candidateOfferDecision,
        unitOfferDecision: applications.unitOfferDecision,
        internshipId: internships.id,
        internshipTitle: internships.title,
        internshipDescription: internships.description,
        internshipDuration: internships.duration,
        internshipJobType: internships.jobType,
        internshipIsPaid: internships.isPaid,
        internshipPayment: internships.payment,
        internshipStatus: internships.status,
        internshipClosingDate: internships.closingDate,
        internshipSkillsRequired: internships.skillsRequired,
        unitUserId: units.userId,
        unitName: unitUser.name,
        unitEmail: unitUser.email,
        unitImage: unitUser.image,
      })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(units, eq(internships.createdBy, units.userId))
      .innerJoin(unitUser, eq(units.userId, unitUser.id))
      .where(appWhereClause)
      .orderBy(desc(applications.createdAt));

    // Step 4: group applications by candidateId in-memory
    const applicationsByCandidateId = new Map<string, typeof applicationRows>();
    for (const app of applicationRows) {
      if (!applicationsByCandidateId.has(app.candidateId)) {
        applicationsByCandidateId.set(app.candidateId, []);
      }
      applicationsByCandidateId.get(app.candidateId)!.push(app);
    }

    // Step 5: merge candidates with their applications
    const candidateData = candidateRows.map((row) => {
      const candidateApps =
        applicationsByCandidateId.get(row.candidateUserId) ?? [];
      return {
        requestId: row.requestId,
        acceptedAt: row.acceptedAt,
        candidate: {
          userId: row.candidateUserId,
          name: row.candidateName,
          email: row.candidateEmail,
          avatarUrl: row.candidateAvatarUrl,
          profileSummary: row.candidateProfileSummary,
          skills: row.candidateSkills,
          experienceLevel: row.candidateExperienceLevel,
        },
        applications: candidateApps.map((app) => ({
          applicationId: app.applicationId,
          status: app.appStatus,
          appliedAt: app.appliedAt,
          updatedAt: app.updatedAt,
          profileScore: app.profileScore,
          candidateOfferDecision: app.candidateOfferDecision,
          unitOfferDecision: app.unitOfferDecision,
          internship: {
            id: app.internshipId,
            title: app.internshipTitle,
            description: app.internshipDescription,
            duration: app.internshipDuration,
            jobType: app.internshipJobType,
            isPaid: app.internshipIsPaid,
            payment: app.internshipPayment,
            status: app.internshipStatus,
            closingDate: app.internshipClosingDate,
            skillsRequired: app.internshipSkillsRequired,
            unit: {
              userId: app.unitUserId,
              name: app.unitName,
              email: app.unitEmail,
              image: app.unitImage,
            },
          },
        })),
      };
    });

    const totalItems = candidateTotalResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);
    const totalApplications = applicationRows.length;

    const message =
      totalApplications === 0
        ? "Your accepted candidates have not applied to any internship yet."
        : "Dashboard data retrieved successfully.";

    return c.json(
      {
        status_code: OK,
        message,
        data: {
          totalAcceptedCandidates: totalItems,
          totalApplications,
          candidates: candidateData,
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
  } catch (err) {
    console.error("Error fetching mentor dashboard:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const getMentorHiredCandidates: AppRouteHandler<
  GetMentorHiredCandidates
> = async (c) => {
  const mentor = c.get("user");
  const { search, page = 1, limit = 10 } = c.req.valid("query");

  try {
    // Step 1: get all accepted candidateIds for this mentor
    const acceptedRows = await db
      .select({ candidateId: mentorshipRequests.candidateId })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.status, "accepted"),
        ),
      );

    const acceptedCandidateIds = acceptedRows.map((r) => r.candidateId);

    // Step 2: early return if no accepted candidates
    if (acceptedCandidateIds.length === 0) {
      return c.json(
        {
          status_code: OK,
          message: "You have not accepted any candidates yet.",
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
          },
        },
        OK,
      );
    }

    const offset = (page - 1) * limit;
    const unitUser = aliasedTable(userTable, "unit_user");

    // Step 3: build conditions — only "hired" applications from accepted candidates
    const baseConditions = [
      inArray(applications.userId, acceptedCandidateIds),
      eq(applications.status, "hired"),
    ];

    const searchCondition = search
      ? sql`(${ilike(userTable.name, `%${search}%`)} OR ${ilike(internships.title, `%${search}%`)})`
      : undefined;

    const allConditions = searchCondition
      ? and(...baseConditions, searchCondition)
      : and(...baseConditions);

    // Step 4: count + data in parallel
    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          applicationId: applications.id,
          appliedAt: applications.createdAt,
          updatedAt: applications.updatedAt,
          candidateOfferDecision: applications.candidateOfferDecision,
          unitOfferDecision: applications.unitOfferDecision,
          // Candidate
          candidateUserId: candidates.userId,
          candidateName: userTable.name,
          candidateEmail: userTable.email,
          candidateAvatarUrl: candidates.avatarUrl,
          candidateProfileSummary: candidates.profileSummary,
          candidateSkills: candidates.skills,
          candidateExperienceLevel: candidates.experienceLevel,
          // Internship
          internshipId: internships.id,
          internshipTitle: internships.title,
          internshipDuration: internships.duration,
          internshipJobType: internships.jobType,
          internshipIsPaid: internships.isPaid,
          internshipPayment: internships.payment,
          // Unit
          unitUserId: units.userId,
          unitName: unitUser.name,
          unitAvatarUrl: units.avatarUrl,
          unitEmail: unitUser.email,
        })
        .from(applications)
        .innerJoin(candidates, eq(applications.userId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(units, eq(internships.createdBy, units.userId))
        .innerJoin(unitUser, eq(units.userId, unitUser.id))
        .where(allConditions)
        .orderBy(desc(applications.updatedAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(applications)
        .innerJoin(candidates, eq(applications.userId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .innerJoin(units, eq(internships.createdBy, units.userId))
        .innerJoin(unitUser, eq(units.userId, unitUser.id))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    const data = rows.map((row) => ({
      applicationId: row.applicationId,
      appliedAt: row.appliedAt,
      updatedAt: row.updatedAt,
      candidateOfferDecision: row.candidateOfferDecision,
      unitOfferDecision: row.unitOfferDecision,
      candidate: {
        userId: row.candidateUserId,
        name: row.candidateName,
        email: row.candidateEmail,
        avatarUrl: row.candidateAvatarUrl,
        profileSummary: row.candidateProfileSummary,
        skills: row.candidateSkills,
        experienceLevel: row.candidateExperienceLevel,
      },
      internship: {
        id: row.internshipId,
        title: row.internshipTitle,
        duration: row.internshipDuration,
        jobType: row.internshipJobType,
        isPaid: row.internshipIsPaid,
        payment: row.internshipPayment,
        unit: {
          userId: row.unitUserId,
          name: row.unitName,
          avatarUrl: row.unitAvatarUrl,
          email: row.unitEmail,
        },
      },
    }));

    const message =
      data.length === 0
        ? "None of your accepted candidates have been hired yet."
        : "Hired candidates retrieved successfully.";

    return c.json(
      {
        status_code: OK,
        message,
        data,
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
    console.error("Error fetching hired candidates for mentor:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// ─── ADD THIS to view.handlers.ts ────────────────────────────────────────────
// Add to route type imports:
//   GetMentorUnitCandidates

/**
 * GET /mentor/units/:unitId/candidates
 *
 * Strategy:
 *  1. Get all accepted candidateIds for this mentor.
 *  2. Early-return if none.
 *  3. Guard: verify at least one accepted candidate applied to this unit
 *     (prevents mentor from querying arbitrary units).
 *  4. Query applications filtered to:
 *       - accepted candidateIds
 *       - internships belonging to this unitId
 *  5. Apply optional search (candidate name) and status filter.
 *  6. Paginate and return.
 */
export const getMentorUnitCandidates: AppRouteHandler<
  GetMentorUnitCandidates
> = async (c) => {
  const mentor = c.get("user");
  const { unitId } = c.req.valid("param");
  const { search, status, page = 1, limit = 10 } = c.req.valid("query");

  try {
    // Step 1: get all accepted candidateIds for this mentor
    const acceptedRows = await db
      .select({ candidateId: mentorshipRequests.candidateId })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.status, "accepted"),
        ),
      );

    const acceptedCandidateIds = acceptedRows.map((r) => r.candidateId);

    // Step 2: early return if no accepted candidates
    if (acceptedCandidateIds.length === 0) {
      return c.json(
        {
          status_code: OK,
          message: "You have not accepted any candidates yet.",
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
          },
        },
        OK,
      );
    }

    // Step 3: guard — confirm at least one accepted candidate applied to this unit
    const [access] = await db
      .select({ id: applications.id })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .where(
        and(
          inArray(applications.userId, acceptedCandidateIds),
          eq(internships.createdBy, unitId),
        ),
      )
      .limit(1);

    if (!access) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message:
            "Unit not found or none of your accepted candidates have applied to this unit.",
        },
        NOT_FOUND,
      );
    }

    // Step 4: build conditions
    const offset = (page - 1) * limit;

    const baseConditions = [
      inArray(applications.userId, acceptedCandidateIds),
      eq(internships.createdBy, unitId),
    ];

    if (status) {
      baseConditions.push(eq(applications.status, status));
    }

    const searchCondition = search
      ? ilike(userTable.name, `%${search}%`)
      : undefined;

    const allConditions = searchCondition
      ? and(...baseConditions, searchCondition)
      : and(...baseConditions);

    // Step 5: count + data in parallel
    const [rows, totalCountResult] = await Promise.all([
      db
        .select({
          applicationId: applications.id,
          applicationStatus: applications.status,
          appliedAt: applications.createdAt,
          updatedAt: applications.updatedAt,
          candidateOfferDecision: applications.candidateOfferDecision,
          unitOfferDecision: applications.unitOfferDecision,
          // Candidate snapshot
          candidateUserId: candidates.userId,
          candidateName: userTable.name,
          candidateEmail: userTable.email,
          candidateAvatarUrl: candidates.avatarUrl,
          candidateProfileSummary: candidates.profileSummary,
          candidateSkills: candidates.skills,
          candidateExperienceLevel: candidates.experienceLevel,
          // Internship they applied to at this unit
          internshipId: internships.id,
          internshipTitle: internships.title,
          internshipDuration: internships.duration,
          internshipJobType: internships.jobType,
          internshipIsPaid: internships.isPaid,
          internshipStatus: internships.status,
        })
        .from(applications)
        .innerJoin(candidates, eq(applications.userId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(allConditions)
        .orderBy(desc(applications.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: count() })
        .from(applications)
        .innerJoin(candidates, eq(applications.userId, candidates.userId))
        .innerJoin(userTable, eq(candidates.userId, userTable.id))
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(allConditions),
    ]);

    const totalItems = totalCountResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    const data = rows.map((row) => ({
      applicationId: row.applicationId,
      applicationStatus: row.applicationStatus,
      appliedAt: row.appliedAt,
      updatedAt: row.updatedAt,
      candidateOfferDecision: row.candidateOfferDecision,
      unitOfferDecision: row.unitOfferDecision,
      candidate: {
        userId: row.candidateUserId,
        name: row.candidateName,
        email: row.candidateEmail,
        avatarUrl: row.candidateAvatarUrl,
        profileSummary: row.candidateProfileSummary,
        skills: row.candidateSkills,
        experienceLevel: row.candidateExperienceLevel,
      },
      internship: {
        id: row.internshipId,
        title: row.internshipTitle,
        duration: row.internshipDuration,
        jobType: row.internshipJobType,
        isPaid: row.internshipIsPaid,
        status: row.internshipStatus,
      },
    }));

    const message =
      data.length === 0
        ? "No candidates found for this unit."
        : "Candidates retrieved successfully.";

    return c.json(
      {
        status_code: OK,
        message,
        data,
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
    console.error("Error fetching unit candidates for mentor:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};
