import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { AppRouteHandler } from "@/types/app.types";

import env from "@/config/env";
import db from "@/db";
import { applications } from "@/db/schema/application.schemas";
import { internships } from "@/db/schema/internship.schemas";
import { notifications } from "@/db/schema/notification.schemas";
import { savedInternship } from "@/db/schema/saved-internship.schemas";
import {
  BAD_REQUEST,
  CONFLICT,
  CREATED,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

// POST /candidate/actions/save - save an internship for the candidate
export const saveInternship: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  // Check if user is a candidate
  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates",
      },
      FORBIDDEN,
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ internshipId: z.uuid() });
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return c.json(
      {
        status_code: BAD_REQUEST,
        message: "Invalid request",
        errors: parse.error.issues,
      },
      BAD_REQUEST,
    );
  }
  const { internshipId } = parse.data;

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

// DELETE /candidate/actions/save - remove saved internship (by internshipId in body)
export const removeSavedInternship: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  // Check if user is a candidate
  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates",
      },
      FORBIDDEN,
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ internshipId: z.uuid() });
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return c.json(
      {
        status_code: BAD_REQUEST,
        message: "Invalid request",
        errors: parse.error.issues,
      },
      BAD_REQUEST,
    );
  }
  const { internshipId } = parse.data;

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
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// POST /candidate/actions/apply - apply to internship with includedSections
export const applyToInternship: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  // Check if user is a candidate
  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates",
      },
      FORBIDDEN,
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    internshipId: z.uuid(),
    includedSections: z.array(z.string()).optional(),
  });
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return c.json(
      {
        status_code: BAD_REQUEST,
        message: "Invalid request",
        errors: parse.error.issues,
      },
      BAD_REQUEST,
    );
  }
  const { internshipId, includedSections } = parse.data;

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

// GET /candidate/actions/saved - list saved internships for user
export const getSavedInternships: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");
  // Check if user is a candidate
  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates",
      },
      FORBIDDEN,
    );
  }

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
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /candidate/actions/applied - list applications for user
export const getAppliedInternships: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  // Check if user is a candidate
  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates",
      },
      FORBIDDEN,
    );
  }

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
      { status_code: INTERNAL_SERVER_ERROR, message: "Internal server error" },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /candidate/actions/counts - get counts for saved and applied
export const getCounts: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");
  // Check if user is a candidate
  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates",
      },
      FORBIDDEN,
    );
  }

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

// GET /candidate/actions/share/:id - generate share links for an internship
export const shareInternship: AppRouteHandler<any> = async (c) => {
  const { id: internshipId } = c.req.param();

  // Validate UUID format
  const uuidSchema = z.uuid();
  const parseId = uuidSchema.safeParse(internshipId);
  if (!parseId.success) {
    return c.json(
      { status_code: BAD_REQUEST, message: "Invalid internship ID format" },
      BAD_REQUEST,
    );
  }

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
