import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { AppRouteHandler } from "@/types/app.types";

import env from "@/config/env";
import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { internships } from "@/db/schema/internship.schema";
import { notifications } from "@/db/schema/notification.schema";
import { savedInternship } from "@/db/schema/saved-internship.schema";
import { units } from "@/db/schema/unit.schema";
import {
  CONFLICT,
  CREATED,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type {
  ApplyToInternship,
  GetApplicationStatus,
  GetAppliedInternships,
  GetCounts,
  GetSavedInternships,
  RemoveSavedInternship,
  SaveInternship,
  ShareInternship,
} from "./action.routes";

// POST /internship/save - save an internship for the candidate
export const saveInternship: AppRouteHandler<SaveInternship> = async (c) => {
  const user = c.get("user");

  const { internshipId } = c.req.valid("json");
  try {
    // check internship exists
    const found = await db
      .select()
      .from(internships)
      .where(eq(internships.id, internshipId));
    if (!found || found.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }

    // prevent duplicate
    const existing = await db
      .select()
      .from(savedInternship)
      .where(
        and(
          eq(savedInternship.candidateId, user.id),
          eq(savedInternship.internshipId, internshipId),
        ),
      );

    if (existing.length > 0) {
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

  const { internshipId } = c.req.valid("json");

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

  const { internshipId, includedSections } = c.req.valid("json");
  try {
    // check internship exists
    const found = await db
      .select()
      .from(internships)
      .where(eq(internships.id, internshipId));
    if (!found || found.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Internship not found" },
        NOT_FOUND,
      );
    }
    const internship = found[0];

    // prevent duplicate application
    const existing = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.userId, user.id),
          eq(applications.internshipId, internshipId),
        ),
      );
    if (existing.length > 0) {
      return c.json(
        { status_code: CONFLICT, message: "Already applied" },
        CONFLICT,
      );
    }

    const insert = await db
      .insert(applications)
      .values({ userId: user.id, internshipId, includedSections })
      .returning();

    // create notification for internship creator (unit user)
    if (internship.createdBy) {
      try {
        await db.insert(notifications).values({
          userId: internship.createdBy,
          title: internship.title,
          message: `${user.email ?? "A candidate"} applied to ${internship.title ?? "an internship"}`,
          type: "info",
        });
      } catch (nerr) {
        console.error(
          "Failed to create notification for internship creator:",
          nerr,
        );
        // Don't fail the entire operation if notification fails
      }
    }

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
        internshipTitle: internships.title,
        internshipDescription: internships.description,
        internshipCreatedBy: internships.createdBy,
      })
      .from(savedInternship)
      .leftJoin(internships, eq(savedInternship.internshipId, internships.id))
      .where(eq(savedInternship.candidateId, user.id));

    return c.json(
      { status_code: OK, message: "Saved internships fetched", data: list },
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
        internshipTitle: internships.title,
        internshipDescription: internships.description,
        internshipCreatedBy: internships.createdBy,
      })
      .from(applications)
      .leftJoin(internships, eq(applications.internshipId, internships.id))
      .where(eq(applications.userId, user.id));

    return c.json(
      { status_code: OK, message: "Applications fetched", data: list },
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
    const saved = await db
      .select()
      .from(savedInternship)
      .where(eq(savedInternship.candidateId, user.id));
    const applied = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, user.id));

    return c.json(
      {
        status_code: OK,
        message: "Counts fetched",
        data: { savedCount: saved.length, appliedCount: applied.length },
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
    const found = await db
      .select()
      .from(internships)
      .where(eq(internships.id, internshipId));
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
        unitName: units.name,
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
