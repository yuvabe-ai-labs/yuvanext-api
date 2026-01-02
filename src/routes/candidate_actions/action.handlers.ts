import { and, count, eq } from "drizzle-orm";
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
import { candidate } from "@/config/auth-permission";

// Helper function to check if email notifications are enabled for a user
async function isEmailNotificationsEnabled(userId: string): Promise<boolean> {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Default to true if no settings found (backward compatibility)
    return settings?.emailNotificationsEnabled ?? true;
  } catch (err) {
    console.error("Error checking email notification settings:", err);
    // Default to true on error to maintain existing behavior
    return true;
  }
}

// Helper function to check if in-app notifications are enabled for a user
async function isInAppNotificationsEnabled(userId: string): Promise<boolean> {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Default to true if no settings found (backward compatibility)
    return settings?.inAppNotificationsEnabled ?? true;
  } catch (err) {
    console.error("Error checking in-app notification settings:", err);
    // Default to true on error to maintain existing behavior
    return true;
  }
}

// Reusable select fragment for internship + unit metadata
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

// Mapping helpers to return a consistent response shape
const mapSavedRow = (row: any) => ({
  id: row.id,
  internshipId: row.internshipId,
  createdAt: row.createdAt,
  internshipTitle: row.internshipTitle,
  internshipDescription: row.internshipDescription,
  createdBy: row.internshipCreatedBy,
  createdByMetadata: {
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

const mapAppliedRow = (row: any) => ({
  id: row.id,
  internshipId: row.internshipId,
  status: row.status,
  includedSections: row.includedSections,
  createdAt: row.createdAt,
  internshipTitle: row.internshipTitle,
  internshipDescription: row.internshipDescription,
  createdBy: row.internshipCreatedBy,
  createdByMetadata: {
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

// POST /internship/save - save an internship for the candidate
export const saveInternship: AppRouteHandler<SaveInternship> = async (c) => {
  const user = c.get("user");
  const { internshipId } = c.req.valid("param");

  try {
    // OPTIMIZED: Combined query using Promise.all to check both conditions in parallel
    const [internshipExists, existingSaved] = await Promise.all([
      db
        .select({ id: internships.id })
        .from(internships)
        .where(eq(internships.id, internshipId))
        .limit(1),
      db
        .select()
        .from(savedInternship)
        .where(
          and(
            eq(savedInternship.candidateId, user.id),
            eq(savedInternship.internshipId, internshipId),
          ),
        )
        .limit(1),
    ]);

    if (!internshipExists || internshipExists.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    if (existingSaved.length > 0) {
      return c.json({ status_code: OK, message: "Already saved" }, OK);
    }

    const insert = await db
      .insert(savedInternship)
      .values({ candidateId: user.id, internshipId })
      .returning();

    return c.json(
      { status_code: CREATED, message: "Saved successfully", data: insert[0] },
      CREATED,
    );
  } catch (err) {
    console.error("Error saving internship:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /internship/save - remove saved internship (by internshipId in body)
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
        { status_code: NOT_FOUND, message: "Saved internship not found" },
        NOT_FOUND,
      );
    }

    return c.json({ status_code: OK, message: "Removed successfully" }, OK);
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

// POST /internship/apply - apply to internship with includedSections
export const applyToInternship: AppRouteHandler<ApplyToInternship> = async (
  c,
) => {
  const user = c.get("user");
  const { internshipId } = c.req.valid("param");
  const { includedSections } = c.req.valid("json");

  try {
    // Check internship exists and prevent duplicate application in a single query
    const [internship, existingApplication] = await Promise.all([
      db
        .select()
        .from(internships)
        .where(eq(internships.id, internshipId))
        .limit(1),
      db
        .select()
        .from(applications)
        .where(
          and(
            eq(applications.userId, user.id),
            eq(applications.internshipId, internshipId),
          ),
        )
        .limit(1),
    ]);

    if (!internship || internship.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    if (existingApplication.length > 0) {
      return c.json(
        { status_code: CONFLICT, message: "Already applied" },
        CONFLICT,
      );
    }

    const internshipData = internship[0];

    // Insert application
    const insert = await db
      .insert(applications)
      .values({ userId: user.id, internshipId, includedSections })
      .returning();

    // Fetch unit details only if createdBy exists
    let unitName = "Our Organization";
    let unitEmail: string | null = null;
    let unitUserId: string | null = null;

    if (internshipData.createdBy) {
      try {
        const unitDetails = await db
          .select({
            name: units.name,
            email: userTable.email,
            userId: userTable.id,
          })
          .from(units)
          .innerJoin(userTable, eq(units.userId, userTable.id))
          .where(eq(units.userId, internshipData.createdBy))
          .limit(1);

        if (unitDetails.length > 0) {
          unitName = unitDetails[0].name || unitName;
          unitEmail = unitDetails[0].email;
          unitUserId = unitDetails[0].userId;
        }
      } catch (err) {
        console.error("Error fetching unit details:", err);
      }
    }

    // Check notification settings for both candidate and unit
    const [candidateEmailEnabled, unitEmailEnabled, unitInAppEnabled] =
      await Promise.all([
        isEmailNotificationsEnabled(user.id),
        unitUserId
          ? isEmailNotificationsEnabled(unitUserId)
          : Promise.resolve(false),
        unitUserId
          ? isInAppNotificationsEnabled(unitUserId)
          : Promise.resolve(false),
      ]);

    // Send emails and create notification in parallel (non-blocking)
    const emailAndNotificationTasks = [];

    // Send email to candidate confirming application (only if enabled)
    if (user.email && candidateEmailEnabled) {
      emailAndNotificationTasks.push(
        sendApplicationEmail("applied", {
          to: user.email,
          candidateName: user.email,
          internshipTitle: internshipData.title || "Internship Position",
          unitName,
        }).catch((emailErr) => {
          console.error(
            "Failed to send application confirmation email to candidate:",
            emailErr,
          );
        }),
      );
    }

    // Send application notification email to unit (only if enabled)
    if (unitEmail && unitEmailEnabled) {
      emailAndNotificationTasks.push(
        sendUnitApplicationNotification({
          to: unitEmail,
          unitName,
          candidateName: user.name || "",
          candidateEmail: user.email || "",
          internshipTitle: internshipData.title || "Internship Position",
        }).catch((emailErr) => {
          console.error(
            "Failed to send application notification email to unit:",
            emailErr,
          );
        }),
      );
    }

    // Create in-app notification for internship creator (only if enabled)
    if (internshipData.createdBy && unitInAppEnabled) {
      emailAndNotificationTasks.push(
        db
          .insert(notifications)
          .values({
            userId: internshipData.createdBy,
            title: internshipData.title,
            message: `${user.email ?? "A candidate"} applied to ${internshipData.title ?? "an internship"}`,
            type: "info",
          })
          .catch((nerr) => {
            console.error(
              "Failed to create notification for internship creator:",
              nerr,
            );
          }),
      );
    }

    // Execute all side effects in parallel without blocking response
    Promise.all(emailAndNotificationTasks).catch(() => {
      // Errors already logged individually
    });

    return c.json(
      {
        status_code: CREATED,
        message: "Applied successfully",
        data: insert[0],
      },
      CREATED,
    );
  } catch (err) {
    console.error("Error applying to internship:", err);
    return c.json(
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /internship/saved - list saved internships for user
export const getSavedInternships: AppRouteHandler<GetSavedInternships> = async (
  c,
) => {
  const user = c.get("user");

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
      .where(eq(savedInternship.candidateId, user.id));

    const transformed = list.map(mapSavedRow);

    return c.json(
      {
        status_code: OK,
        message: "Saved internships fetched",
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

// GET /internship/applied - list applications for user
export const getAppliedInternships: AppRouteHandler<
  GetAppliedInternships
> = async (c) => {
  const user = c.get("user");

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
      .where(eq(applications.userId, user.id));

    const transformed = list.map(mapAppliedRow);

    return c.json(
      { status_code: OK, message: "Applications fetched", data: transformed },
      OK,
    );
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

// GET /internship/counts - get counts for saved and applied
export const getCounts: AppRouteHandler<GetCounts> = async (c) => {
  const user = c.get("user");

  try {
    // OPTIMIZED: Use count() instead of selecting all rows
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
        message: "Counts fetched",
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

// GET /internship/share/:id - generate share links for an internship
export const shareInternship: AppRouteHandler<ShareInternship> = async (c) => {
  const { id: internshipId } = c.req.valid("param");

  try {
    // OPTIMIZED: Select only needed fields
    const found = await db
      .select({
        id: internships.id,
        title: internships.title,
      })
      .from(internships)
      .where(eq(internships.id, internshipId))
      .limit(1);

    if (!found || found.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    const internship = found[0];

    const frontendBase = env.FRONTEND_URL || "https://app.yuvanext.com";
    // Note: This token is generated but not persisted.
    // Consider storing it if you need to track/validate shares
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

// GET /internship/application-status - get application status with unit details
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
        avatarUrl: units.avatarUrl,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
      })
      .from(applications)
      .leftJoin(internships, eq(applications.internshipId, internships.id))
      .leftJoin(units, eq(internships.createdBy, units.userId))
      .where(eq(applications.userId, user.id))
      .orderBy(applications.createdAt);

    return c.json(
      {
        status_code: OK,
        message: "Application status fetched",
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

// POST /internship/application/:applicationId/accept-offer - accept or reject internship offer
export const acceptOffer: AppRouteHandler<AcceptOffer> = async (c) => {
  const user = c.get("user");
  const { applicationId } = c.req.valid("param");
  const { decision } = c.req.valid("json");

  try {
    // Fetch the application to check if the unit has selected the candidate
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
        { status_code: NOT_FOUND, message: "Application not found" },
        NOT_FOUND,
      );
    }

    // Check if unit has selected the candidate
    if (application.unitOfferDecision !== "selected") {
      return c.json(
        {
          status_code: CONFLICT,
          message:
            "Cannot respond to offer - unit has not selected you or offer has already been responded to",
        },
        CONFLICT,
      );
    }

    // Update candidate offer decision with the provided decision (accept or reject)
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
        message: `Offer ${decision} successfully`,
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
