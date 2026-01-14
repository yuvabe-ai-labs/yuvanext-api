import { and, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { AppRouteHandler } from "@/types/app.types";

import env from "@/config/env";
import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { user as userTable } from "@/db/schema/auth.schema";
import { internships } from "@/db/schema/internship.schema";
import { notifications } from "@/db/schema/notification.schema";
import { savedInternship } from "@/db/schema/saved-internship.schema";
import { userSettings } from "@/db/schema/settings.schema";
import { units } from "@/db/schema/unit.schema";
import {
  CONFLICT,
  CREATED,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";
import {
  sendApplicationEmail,
  sendUnitApplicationNotification,
} from "@/lib/services/email.service";

import type {
  AcceptOffer,
  ApplyToInternship,
  GetApplicationStatus,
  GetAppliedInternships,
  GetCounts,
  GetSavedInternships,
  RemoveSavedInternship,
  SaveInternship,
  ShareInternship,
} from "./action.routes";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type NotificationSettings = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

type SavedInternshipRow = {
  id: string;
  internshipId: string | null;
  createdAt: Date | null;
  internshipTitle: string | null;
  internshipDescription: string | null;
  internshipCreatedBy: string | null;
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

type AppliedInternshipRow = {
  id: string;
  internshipId: string | null;
  status:
    | "applied"
    | "shortlisted"
    | "rejected"
    | "interviewed"
    | "hired"
    | "not_shortlisted"
    | null;
  includedSections: string[] | null;
  createdAt: Date | null;
  internshipTitle: string | null;
  internshipDescription: string | null;
  internshipCreatedBy: string | null;
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get notification settings for a user
 * Returns both email and in-app notification preferences in a single query
 */
async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  try {
    const [settings] = await db
      .select({
        emailEnabled: userSettings.emailNotificationsEnabled,
        inAppEnabled: userSettings.inAppNotificationsEnabled,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return {
      emailEnabled: settings?.emailEnabled ?? true,
      inAppEnabled: settings?.inAppEnabled ?? true,
    };
  } catch (err) {
    console.error("Error checking notification settings:", err);
    return { emailEnabled: true, inAppEnabled: true };
  }
}

/**
 * Reusable select fragment for internship + unit metadata
 */
const internshipWithUnitSelect = () => ({
  internshipTitle: internships.title,
  internshipDescription: internships.description,
  internshipCreatedBy: internships.createdBy,
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
 * Map saved internship row to response format
 */
const mapSavedRow = (row: SavedInternshipRow) => ({
  id: row.id,
  internshipId: row.internshipId ?? "",
  createdAt: row.createdAt ?? new Date(),
  internshipTitle: row.internshipTitle,
  internshipDescription: row.internshipDescription,
  createdBy: {
    userId: row.unitUserId ?? null,
    name: row.unitName ?? null,
    address: row.unitAddress ?? null,
    phone: row.unitPhone ?? null,
    websiteUrl: row.unitWebsiteUrl ?? null,
    description: row.unitDescription ?? null,
    avatarUrl: row.unitAvatarUrl ?? null,
    bannerUrl: row.unitBannerUrl ?? null,
    location: row.unitLocation ?? null,
  },
});

/**
 * Map applied internship row to response format
 */
const mapAppliedRow = (row: AppliedInternshipRow) => ({
  id: row.id,
  internshipId: row.internshipId ?? "",
  status: row.status ?? "applied",
  includedSections: row.includedSections,
  createdAt: row.createdAt ?? new Date(),
  internshipTitle: row.internshipTitle,
  internshipDescription: row.internshipDescription,
  createdBy: {
    userId: row.unitUserId ?? null,
    name: row.unitName ?? null,
    address: row.unitAddress ?? null,
    phone: row.unitPhone ?? null,
    websiteUrl: row.unitWebsiteUrl ?? null,
    description: row.unitDescription ?? null,
    avatarUrl: row.unitAvatarUrl ?? null,
    bannerUrl: row.unitBannerUrl ?? null,
    location: row.unitLocation ?? null,
  },
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /candidate/internship/:internshipId/save
 * Save an internship for the candidate
 */
export const saveInternship: AppRouteHandler<SaveInternship> = async (c) => {
  const user = c.get("user");
  const { internshipId } = c.req.valid("param");

  try {
    const result = await db
      .insert(savedInternship)
      .values({ candidateId: user.id, internshipId })
      .onConflictDoNothing()
      .returning();

    const saved = result.length > 0;

    return c.json(
      {
        message: saved
          ? "Internship saved successfully"
          : "Internship already saved",
      },
      saved ? CREATED : CONFLICT,
    );
  } catch (err: any) {
    console.error("Error saving internship:", err);

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
 * DELETE /candidate/internship/:internshipId/save
 * Remove saved internship
 */
export const removeSavedInternship: AppRouteHandler<
  RemoveSavedInternship
> = async (c) => {
  const user = c.get("user");
  const { internshipId } = c.req.valid("param");

  try {
    const result = await db
      .delete(savedInternship)
      .where(
        and(
          eq(savedInternship.candidateId, user.id),
          eq(savedInternship.internshipId, internshipId),
        ),
      )
      .returning();

    if (result.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Saved internship not found",
          code: "SAVED_INTERNSHIP_NOT_FOUND",
          resource: { internshipId },
        },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Saved internship removed successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error removing saved internship:", err);
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
 * POST /candidate/internship/:internshipId/apply
 * Apply to internship with includedSections
 */
export const applyToInternship: AppRouteHandler<ApplyToInternship> = async (
  c,
) => {
  const user = c.get("user");
  const { internshipId } = c.req.valid("param");
  const { includedSections } = c.req.valid("json");

  try {
    const [internship] = await db
      .select()
      .from(internships)
      .where(eq(internships.id, internshipId))
      .limit(1);

    if (!internship) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Internship not found",
          code: "INTERNSHIP_NOT_FOUND",
          resource: { internshipId },
        },
        NOT_FOUND,
      );
    }

    const internshipData = internship;

    let insert;
    try {
      [insert] = await db
        .insert(applications)
        .values({ userId: user.id, internshipId, includedSections })
        .returning();
    } catch (dbError: any) {
      if (dbError.code === "23505" || dbError.constraint) {
        return c.json(
          {
            status_code: CONFLICT,
            message: "You have already applied to this internship",
            code: "DUPLICATE_APPLICATION",
            resource: { internshipId },
          },
          CONFLICT,
        );
      }
      throw dbError;
    }

    const [userRecord] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1);

    const candidateEmail = userRecord?.email;

    const [unitRecord] = await db
      .select({
        userId: units.userId,
        name: units.name,
        email: userTable.email,
      })
      .from(units)
      .leftJoin(userTable, eq(units.userId, userTable.id))
      .where(eq(units.userId, internshipData.createdBy))
      .limit(1);

    const unitUserId = unitRecord?.userId;
    const unitName = unitRecord?.name;
    const unitEmail = unitRecord?.email;

    const unitSettings = unitUserId
      ? await getNotificationSettings(unitUserId)
      : { emailEnabled: true, inAppEnabled: true };

    const emailAndNotificationTasks: Promise<any>[] = [];

    if (candidateEmail && internshipData.title) {
      emailAndNotificationTasks.push(
        sendApplicationEmail("applied", {
          to: candidateEmail,
          candidateName: candidateEmail,
          internshipTitle: internshipData.title,
          unitName: unitName || "the unit",
        }).catch((emailError) => {
          console.error("CRITICAL: Candidate email failed", {
            applicationId: insert.id,
            candidateEmail,
            error: emailError.message,
          });
        }),
      );
    }

    if (unitSettings.emailEnabled && unitEmail && internshipData.title) {
      emailAndNotificationTasks.push(
        sendUnitApplicationNotification({
          to: unitEmail,
          unitName: unitName || "Unit",
          internshipTitle: internshipData.title,
          candidateName: user.name || "A candidate",
          candidateEmail: candidateEmail || "unknown@email.com",
        }).catch((emailError) => {
          console.error("CRITICAL: Unit notification email failed", {
            applicationId: insert.id,
            unitEmail,
            error: emailError.message,
          });
        }),
      );
    }

    if (unitSettings.inAppEnabled && unitUserId && internshipData.title) {
      emailAndNotificationTasks.push(
        db
          .insert(notifications)
          .values({
            userId: unitUserId,
            type: "info",
            title: internshipData.title,
            message: `${candidateEmail ?? "A candidate"} applied to ${internshipData.title ?? "an internship"}`,
          })
          .catch((notifError) => {
            console.error("Error creating in-app notification", {
              applicationId: insert.id,
              unitUserId,
              error: notifError.message,
            });
          }),
      );
    }

    Promise.all(emailAndNotificationTasks).catch(() => {});

    return c.json(
      {
        status_code: CREATED,
        message: "Application submitted successfully",
        data: insert,
      },
      CREATED,
    );
  } catch (err) {
    console.error("Error applying to internship:", err);
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
 * GET /candidate/internship/save
 * List all saved internships for user
 */
export const getSavedInternships: AppRouteHandler<GetSavedInternships> = async (
  c,
) => {
  const user = c.get("user");
  const { sortOrder } = c.req.valid("query");

  try {
    const list = await db
      .select({
        id: savedInternship.id,
        internshipId: savedInternship.internshipId,
        createdAt: savedInternship.createdAt,
        ...internshipWithUnitSelect(),
      })
      .from(savedInternship)
      .leftJoin(internships, eq(savedInternship.internshipId, internships.id))
      .leftJoin(units, eq(internships.createdBy, units.userId))
      .where(eq(savedInternship.candidateId, user.id))
      .orderBy(
        sortOrder === "asc"
          ? savedInternship.createdAt
          : desc(savedInternship.createdAt),
      );

    const transformed = list.map(mapSavedRow);

    return c.json(
      {
        status_code: OK,
        message: "Saved internships fetched successfully",
        data: transformed,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching saved internships:", err);
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
 * GET /candidate/internship/apply
 * List all applications for user
 */
export const getAppliedInternships: AppRouteHandler<
  GetAppliedInternships
> = async (c) => {
  const user = c.get("user");
  const { sortOrder } = c.req.valid("query");

  try {
    const list = await db
      .select({
        id: applications.id,
        internshipId: applications.internshipId,
        status: applications.status,
        includedSections: applications.includedSections,
        createdAt: applications.createdAt,
        ...internshipWithUnitSelect(),
      })
      .from(applications)
      .leftJoin(internships, eq(applications.internshipId, internships.id))
      .leftJoin(units, eq(internships.createdBy, units.userId))
      .where(eq(applications.userId, user.id))
      .orderBy(
        sortOrder === "asc"
          ? applications.createdAt
          : desc(applications.createdAt),
      );

    const transformed = list.map(mapAppliedRow);

    return c.json(
      {
        status_code: OK,
        message: "Applied internships fetched successfully",
        data: transformed,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching applied internships:", err);
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
 * GET /candidate/internship/counts
 * Get counts for saved and applied internships
 */
export const getCounts: AppRouteHandler<GetCounts> = async (c) => {
  const user = c.get("user");

  try {
    const [savedResult, appliedResult] = await Promise.all([
      db
        .select({ count: count() })
        .from(savedInternship)
        .where(eq(savedInternship.candidateId, user.id)),
      db
        .select({ count: count() })
        .from(applications)
        .where(eq(applications.userId, user.id)),
    ]);

    return c.json(
      {
        status_code: OK,
        message: "Counts fetched successfully",
        data: {
          savedCount: savedResult[0]?.count || 0,
          appliedCount: appliedResult[0]?.count || 0,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching counts:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /candidate/internship/share/:id
 * Generate share links for an internship
 */
export const shareInternship: AppRouteHandler<ShareInternship> = async (c) => {
  const { id: internshipId } = c.req.valid("param");

  try {
    const [internship] = await db
      .select({
        id: internships.id,
        title: internships.title,
      })
      .from(internships)
      .where(eq(internships.id, internshipId))
      .limit(1);

    if (!internship) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Internship not found",
          code: "INTERNSHIP_NOT_FOUND",
          resource: { internshipId },
        },
        NOT_FOUND,
      );
    }

    const frontendBase = env.FRONTEND_URL || "https://app.yuvanext.com";
    const token = randomUUID();
    const url = `${frontendBase}/internships/${internshipId}?share=${token}`;
    const title = internship.title ?? "Internship Opportunity";

    const links = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
      x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`,
      url,
    };

    return c.json(
      { status_code: OK, message: "Share links generated", data: links },
      OK,
    );
  } catch (err) {
    console.error("Error generating share links:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * GET /candidate/internship/application-status
 * Get application status with unit details
 */
export const getApplicationStatus: AppRouteHandler<
  GetApplicationStatus
> = async (c) => {
  const user = c.get("user");

  try {
    const list = await db
      .select({
        id: applications.id,
        applicationTitle: internships.title,
        status: applications.status,
        candidateOfferDecision: applications.candidateOfferDecision,
        unitOfferDecision: applications.unitOfferDecision,
        unitName: units.name,
        avatarUrl: units.avatarUrl,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
      })
      .from(applications)
      .leftJoin(internships, eq(applications.internshipId, internships.id))
      .leftJoin(units, eq(internships.createdBy, units.userId))
      .where(eq(applications.userId, user.id))
      .orderBy(desc(applications.createdAt));

    return c.json(
      {
        status_code: OK,
        message: "Application status fetched successfully",
        data: list,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching application status:", err);
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
 * POST /candidate/internship/application/:applicationId/accept-offer
 * Accept or reject internship offer
 */
export const acceptOffer: AppRouteHandler<AcceptOffer> = async (c) => {
  const user = c.get("user");
  const { applicationId } = c.req.valid("param");
  const { decision } = c.req.valid("json");

  try {
    const [application] = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.userId, user.id),
        ),
      )
      .limit(1);

    if (!application) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Application not found or does not belong to you",
          code: "APPLICATION_NOT_FOUND",
          resource: { applicationId },
        },
        NOT_FOUND,
      );
    }

    if (application.unitOfferDecision !== "selected") {
      return c.json(
        {
          status_code: CONFLICT,
          message:
            "Cannot respond to offer - unit has not selected you or offer has already been responded to",
          code: "OFFER_NOT_AVAILABLE",
          resource: {
            applicationId,
            unitOfferDecision: application.unitOfferDecision,
          },
        },
        CONFLICT,
      );
    }

    const [updated] = await db
      .update(applications)
      .set({
        candidateOfferDecision: decision,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update application");
    }

    return c.json(
      {
        status_code: OK,
        message: `Offer ${decision}ed successfully`,
        data: updated,
      },
      OK,
    );
  } catch (err) {
    console.error("Error responding to offer:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};
