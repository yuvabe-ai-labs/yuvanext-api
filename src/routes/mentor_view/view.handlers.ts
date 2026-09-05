import { applications } from "@/db/schema/application.schema";
import { internships } from "@/db/schema/internship.schema";
import { units } from "@/db/schema/unit.schema";
import {
  aliasedTable,
  and,
  type AnyColumn,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  sql,
} from "drizzle-orm";
import {
  GetMenteeGrowth,
  GetMentorAcceptedCandidates,
  GetMentorStats,
  GetMentorUnitProfile,
  GetMentorUnits,
} from "./view.routes";
import { AppRouteHandler } from "@/types/app.types";
import { mentorshipRequests } from "@/db/schema/mentorship-requests.schema";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import db from "@/db";
import { countDistinct, gt, gte, lt } from "drizzle-orm";
import { meetings } from "@/db/schema/meeting.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

/**
 * GET /mentor/accepted-candidates
 *
 * Supports three modes via the `filter` query parameter:
 *
 *  "recent" (default when filter is omitted or "recent"):
 *    Returns the 10 most-recently accepted candidates. No pagination applied.
 *    Useful for dashboard widgets / quick overviews.
 *
 *  "all":
 *    Returns all accepted candidates with full pagination.
 *    search → filter by candidate name (case-insensitive).
 *
 *  "unit":
 *    Returns only the accepted candidates who have at least one application
 *    to an internship belonging to the given `unitId`.
 *    search → additionally filter by candidate name.
 *    Paginated.
 */
export const getMentorAcceptedCandidates: AppRouteHandler<
  GetMentorAcceptedCandidates
> = async (c) => {
  const user = c.get("user");
  const {
    filter = "all",
    unitId,
    search,
    page = 1,
    limit = 10,
  } = c.req.valid("query");

  try {
    // ── Alias unit's user row to avoid column clash with candidate user ─────────
    const unitUser = aliasedTable(userTable, "unit_user");

    // ── One application summary row per candidate ─────────────────────────────
    // Joining applications directly would emit one row per application, so a
    // candidate with several applications appeared several times and inflated
    // the page against a count that only counts mentorship requests. Grouping
    // by candidate here keeps rows 1:1 with accepted mentees; array_agg picks
    // the most recent application. Pass unitId to scope it to one unit.
    const buildApplicationSummary = (scopedUnitId?: string) => {
      const pickLatest = (column: AnyColumn) =>
        sql`(array_agg(${column} order by ${applications.createdAt} desc))[1]`;

      const query = db
        .select({
          candidateId: applications.userId,
          applicationId: pickLatest(applications.id).as("application_id"),
          applicationStatus: pickLatest(applications.status).as(
            "application_status",
          ),
          internshipTitle: pickLatest(internships.title).as("internship_title"),
          unitName: pickLatest(unitUser.name).as("unit_name"),
        })
        .from(applications)
        .leftJoin(internships, eq(internships.id, applications.internshipId))
        .leftJoin(units, eq(units.userId, internships.createdBy))
        .leftJoin(unitUser, eq(unitUser.id, units.userId));

      return (
        scopedUnitId
          ? query.where(eq(internships.createdBy, scopedUnitId))
          : query
      )
        .groupBy(applications.userId)
        .as("application_summary");
    };

    // ── Shared candidate + latest application select ──────────────────────────
    // The application summary is LEFT JOINed, so candidates with no
    // applications are still returned with null application fields.
    const candidateSelect = (
      appSummary: ReturnType<typeof buildApplicationSummary>,
    ) =>
      ({
        requestId: mentorshipRequests.id,
        message: mentorshipRequests.message,
        requestedAt: mentorshipRequests.createdAt,
        acceptedAt: mentorshipRequests.updatedAt,
        candidateUserId: candidates.userId,
        candidateName: userTable.name,
        candidateEmail: userTable.email,
        candidateAvatarUrl: candidates.avatarUrl,
        candidateProfileSummary: candidates.profileSummary,
        candidateSkills: candidates.skills,
        candidateExperienceLevel: candidates.experienceLevel,
        // Application enrichment fields (null when candidate has no application)
        applicationId: appSummary.applicationId,
        applicationStatus: appSummary.applicationStatus,
        internshipTitle: appSummary.internshipTitle,
        unitName: appSummary.unitName,
      }) as const;

    const mapRow = (row: (typeof rows)[number]) => ({
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
      },
      // null when the candidate has not applied anywhere yet
      application: row.applicationId
        ? {
            applicationId: row.applicationId,
            status: row.applicationStatus,
            internshipTitle: row.internshipTitle,
            unitName: row.unitName,
          }
        : null,
    });

    // ── Attach the per-candidate application summary (never multiplies rows) ──
    const applyAppJoins = (
      q: any,
      appSummary: ReturnType<typeof buildApplicationSummary>,
    ) => q.leftJoin(appSummary, eq(appSummary.candidateId, candidates.userId));

    // ── MODE: "recent" ────────────────────────────────────────────────────────
    // Return the 10 most-recently accepted candidates with their application info.
    if (filter === "recent") {
      const baseConditions = [
        eq(mentorshipRequests.mentorId, user.id),
        eq(mentorshipRequests.status, "accepted"),
      ];
      const whereClause = search
        ? and(...baseConditions, ilike(userTable.name, `%${search}%`))
        : and(...baseConditions);

      const appSummary = buildApplicationSummary();
      const rows = await applyAppJoins(
        db
          .select(candidateSelect(appSummary))
          .from(mentorshipRequests)
          .innerJoin(
            candidates,
            eq(mentorshipRequests.candidateId, candidates.userId),
          )
          .innerJoin(userTable, eq(candidates.userId, userTable.id)) as any,
        appSummary,
      )
        .where(whereClause)
        .orderBy(desc(mentorshipRequests.updatedAt))
        .limit(10);

      return c.json(
        {
          status_code: OK,
          message: "Recent accepted candidates retrieved successfully",
          data: rows.map(mapRow),
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: rows.length,
            itemsPerPage: 10,
          },
        },
        OK,
      );
    }

    // ── MODE: "unit" ──────────────────────────────────────────────────────────
    // Return accepted candidates who applied to the given unitId, with their
    // application at that unit included in the response.
    if (filter === "unit") {
      if (!unitId) {
        return c.json(
          {
            status_code: INTERNAL_SERVER_ERROR,
            message: "unitId is required when filter is 'unit'",
          },
          INTERNAL_SERVER_ERROR,
        );
      }

      const offset = (page - 1) * limit;

      // Step 1: collect all accepted candidateIds for this mentor
      const acceptedRows = await db
        .select({ candidateId: mentorshipRequests.candidateId })
        .from(mentorshipRequests)
        .where(
          and(
            eq(mentorshipRequests.mentorId, user.id),
            eq(mentorshipRequests.status, "accepted"),
          ),
        );

      const acceptedCandidateIds = acceptedRows.map((r) => r.candidateId);

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

      // Step 2: which of those candidates applied to this unit?
      const candidatesAtUnit = await db
        .selectDistinct({ candidateId: applications.userId })
        .from(applications)
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(
          and(
            inArray(applications.userId, acceptedCandidateIds),
            eq(internships.createdBy, unitId),
          ),
        );

      const candidateIdsAtUnit = candidatesAtUnit.map((r) => r.candidateId);

      if (candidateIdsAtUnit.length === 0) {
        return c.json(
          {
            status_code: OK,
            message:
              "None of your accepted candidates have applied to this unit.",
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

      // Step 3: fetch candidates with their application scoped to this unit
      const baseConditions = [
        eq(mentorshipRequests.mentorId, user.id),
        eq(mentorshipRequests.status, "accepted"),
        inArray(mentorshipRequests.candidateId, candidateIdsAtUnit),
        // Scope the LEFT JOIN result to only this unit's internships
        eq(internships.createdBy, unitId),
      ];

      const whereClause = search
        ? and(...baseConditions, ilike(userTable.name, `%${search}%`))
        : and(...baseConditions);

      // Count query doesn't need app joins — count from mentorshipRequests only
      const countConditions = search
        ? and(
            eq(mentorshipRequests.mentorId, user.id),
            eq(mentorshipRequests.status, "accepted"),
            inArray(mentorshipRequests.candidateId, candidateIdsAtUnit),
            ilike(userTable.name, `%${search}%`),
          )
        : and(
            eq(mentorshipRequests.mentorId, user.id),
            eq(mentorshipRequests.status, "accepted"),
            inArray(mentorshipRequests.candidateId, candidateIdsAtUnit),
          );

      const appSummary = buildApplicationSummary(unitId);
      const [rows, totalCountResult] = await Promise.all([
        applyAppJoins(
          db
            .select(candidateSelect(appSummary))
            .from(mentorshipRequests)
            .innerJoin(
              candidates,
              eq(mentorshipRequests.candidateId, candidates.userId),
            )
            .innerJoin(userTable, eq(candidates.userId, userTable.id)) as any,
          appSummary,
        )
          .where(whereClause)
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
          .where(countConditions),
      ]);

      const totalItems = totalCountResult[0]?.count ?? 0;
      const totalPages = Math.ceil(totalItems / limit);

      return c.json(
        {
          status_code: OK,
          message:
            rows.length === 0
              ? "No candidates found for this unit."
              : "Candidates for unit retrieved successfully",
          data: rows.map(mapRow),
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

    // ── MODE: "all" (default) ─────────────────────────────────────────────────
    // Full paginated list of all accepted candidates with their latest application.
    const offset = (page - 1) * limit;

    const baseConditions = [
      eq(mentorshipRequests.mentorId, user.id),
      eq(mentorshipRequests.status, "accepted"),
    ];

    const allConditions = search
      ? and(...baseConditions, ilike(userTable.name, `%${search}%`))
      : and(...baseConditions);

    const appSummary = buildApplicationSummary();
    const [rows, totalCountResult] = await Promise.all([
      applyAppJoins(
        db
          .select(candidateSelect(appSummary))
          .from(mentorshipRequests)
          .innerJoin(
            candidates,
            eq(mentorshipRequests.candidateId, candidates.userId),
          )
          .innerJoin(userTable, eq(candidates.userId, userTable.id)) as any,
        appSummary,
      )
        .where(allConditions)
        .orderBy(desc(mentorshipRequests.updatedAt))
        .limit(limit)
        .offset(offset),

      // Count on mentorshipRequests only (no app joins needed for pagination count)
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

    return c.json(
      {
        status_code: OK,
        message: "Accepted candidates retrieved successfully",
        data: rows.map(mapRow),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the first and last instant of the current calendar month (UTC). */
function currentMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start, end };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * GET /mentor/stats
 *
 * All four counts are fetched in parallel for performance.
 * Each stat returns:
 *   total        – all-time figure
 *   newThisMonth – items created / scheduled in the current calendar month
 */
export const getMentorStats: AppRouteHandler<GetMentorStats> = async (c) => {
  const mentor = c.get("user");
  const { start: monthStart, end: monthEnd } = currentMonthBounds();

  try {
    // ── 0. Pending Mentorship Requests ───────────────────────────────────────
    // Requests sent to this mentor that are still awaiting a response.
    // newThisMonth → pending requests *created* (createdAt) this month.
    const pendingRequestsPromise = Promise.all([
      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .where(
          and(
            eq(mentorshipRequests.mentorId, mentor.id),
            eq(mentorshipRequests.status, "pending"),
          ),
        ),
      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .where(
          and(
            eq(mentorshipRequests.mentorId, mentor.id),
            eq(mentorshipRequests.status, "pending"),
            gte(mentorshipRequests.createdAt, monthStart),
            lt(mentorshipRequests.createdAt, monthEnd),
          ),
        ),
    ]);

    // ── 1. Accepted Mentees ───────────────────────────────────────────────────
    // "accepted" rows in mentorship_requests where mentorId = me.
    // newThisMonth → requests accepted (updatedAt) in current month.
    const acceptedMenteesPromise = Promise.all([
      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .where(
          and(
            eq(mentorshipRequests.mentorId, mentor.id),
            eq(mentorshipRequests.status, "accepted"),
          ),
        ),
      db
        .select({ count: count() })
        .from(mentorshipRequests)
        .where(
          and(
            eq(mentorshipRequests.mentorId, mentor.id),
            eq(mentorshipRequests.status, "accepted"),
            // updatedAt is when the status last changed — i.e. when accepted
            gte(mentorshipRequests.updatedAt, monthStart),
            lt(mentorshipRequests.updatedAt, monthEnd),
          ),
        ),
    ]);

    // ── 2. Unique Units from Mentees' Applications ────────────────────────────
    // Distinct unit IDs (internships.createdBy) across applications by accepted mentees.
    // newThisMonth → applications that were *submitted* this month (applications.createdAt).
    // We count distinct units from those new applications, mirroring the total logic.
    const acceptedCandidateSubquery = db
      .select({ candidateId: mentorshipRequests.candidateId })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.status, "accepted"),
        ),
      );

    const menteeUnitsPromise = Promise.all([
      // total distinct units
      db
        .select({ count: countDistinct(internships.createdBy) })
        .from(applications)
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(sql`${applications.userId} IN (${acceptedCandidateSubquery})`),
      // distinct units from applications submitted this month
      db
        .select({ count: countDistinct(internships.createdBy) })
        .from(applications)
        .innerJoin(internships, eq(applications.internshipId, internships.id))
        .where(
          and(
            sql`${applications.userId} IN (${acceptedCandidateSubquery})`,
            gte(applications.createdAt, monthStart),
            lt(applications.createdAt, monthEnd),
          ),
        ),
    ]);

    // ── 3. Upcoming Meetings ──────────────────────────────────────────────────
    // Meetings where mentorId = me, status = "pending", scheduledAt > now.
    // newThisMonth → pending future meetings *created* (createdAt) this month.
    const now = new Date();
    // total → every meeting the mentor has, cancelled ones excluded since they
    // never took place. newThisMonth → meetings scheduled within this month.
    const upcomingMeetingsPromise = Promise.all([
      db
        .select({ count: count() })
        .from(meetings)
        .where(
          and(
            eq(meetings.mentorId, mentor.id),
            ne(meetings.status, "cancelled"),
          ),
        ),
      db
        .select({ count: count() })
        .from(meetings)
        .where(
          and(
            eq(meetings.mentorId, mentor.id),
            ne(meetings.status, "cancelled"),
            gte(meetings.scheduledAt, monthStart),
            lt(meetings.scheduledAt, monthEnd),
          ),
        ),
    ]);

    // ── 4. Hired Applications ─────────────────────────────────────────────────
    // Applications with status = "hired" from accepted mentees.
    // newThisMonth → those hired applications updated (status set) this month.
    const hiredApplicationsPromise = Promise.all([
      db
        .select({ count: count() })
        .from(applications)
        .where(
          and(
            sql`${applications.userId} IN (${acceptedCandidateSubquery})`,
            eq(applications.status, "hired"),
          ),
        ),
      db
        .select({ count: count() })
        .from(applications)
        .where(
          and(
            sql`${applications.userId} IN (${acceptedCandidateSubquery})`,
            eq(applications.status, "hired"),
            gte(applications.updatedAt, monthStart),
            lt(applications.updatedAt, monthEnd),
          ),
        ),
    ]);

    // ── Await all in parallel ─────────────────────────────────────────────────
    const [
      [pendingTotal, pendingNew],
      [acceptedTotal, acceptedNew],
      [unitsTotal, unitsNew],
      [upcomingTotal, upcomingNew],
      [hiredTotal, hiredNew],
    ] = await Promise.all([
      pendingRequestsPromise,
      acceptedMenteesPromise,
      menteeUnitsPromise,
      upcomingMeetingsPromise,
      hiredApplicationsPromise,
    ]);

    return c.json(
      {
        status_code: OK,
        message: "Mentor stats retrieved successfully.",
        data: {
          pendingRequests: {
            total: pendingTotal[0]?.count ?? 0,
            newThisMonth: pendingNew[0]?.count ?? 0,
          },
          acceptedMentees: {
            total: acceptedTotal[0]?.count ?? 0,
            newThisMonth: acceptedNew[0]?.count ?? 0,
          },
          menteeUnitCount: {
            total: unitsTotal[0]?.count ?? 0,
            newThisMonth: unitsNew[0]?.count ?? 0,
          },
          upcomingMeetings: {
            total: upcomingTotal[0]?.count ?? 0,
            newThisMonth: upcomingNew[0]?.count ?? 0,
          },
          hiredApplications: {
            total: hiredTotal[0]?.count ?? 0,
            newThisMonth: hiredNew[0]?.count ?? 0,
          },
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching mentor stats:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /mentor/mentee-growth
 *
 * How many mentees joined each month. "Joined" means the mentorship request
 * reached status "accepted", tracked by updatedAt — the same definition the
 * stats tile uses for acceptedMentees.newThisMonth, so the chart and the tile
 * agree.
 *
 * Bucketing happens in SQL; the handler only fills the gaps so months with no
 * joins still appear as 0 and the series is safe to plot directly.
 */
export const getMenteeGrowth: AppRouteHandler<GetMenteeGrowth> = async (c) => {
  const mentor = c.get("user");
  const { months = 6 } = c.req.valid("query");

  try {
    const now = new Date();
    // First day of the earliest month in the window, local to the server.
    const windowStart = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1),
      1,
    );

    const rows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${mentorshipRequests.updatedAt}), 'YYYY-MM')`,
        count: count(),
      })
      .from(mentorshipRequests)
      .where(
        and(
          eq(mentorshipRequests.mentorId, mentor.id),
          eq(mentorshipRequests.status, "accepted"),
          gte(mentorshipRequests.updatedAt, windowStart),
        ),
      )
      .groupBy(sql`date_trunc('month', ${mentorshipRequests.updatedAt})`);

    const countsByMonth = new Map(rows.map((row) => [row.month, row.count]));

    const MONTH_LABELS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const series = Array.from({ length: months }, (_, offset) => {
      const date = new Date(
        windowStart.getFullYear(),
        windowStart.getMonth() + offset,
        1,
      );
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      return {
        month: key,
        label: MONTH_LABELS[date.getMonth()],
        year: date.getFullYear(),
        count: countsByMonth.get(key) ?? 0,
      };
    });

    return c.json(
      {
        status_code: OK,
        message: "Mentee growth retrieved successfully.",
        data: {
          months: series,
          total: series.reduce((sum, point) => sum + point.count, 0),
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching mentee growth:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
