import { desc, eq } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { units } from "@/db/schema/unit.schemas";
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNPROCESSABLE_ENTITY,
} from "@/lib/openapi/http-status-codes";

// GET /units - Get all units (candidate only)
export const getAllUnits: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates can view all units",
      },
      FORBIDDEN,
    );
  }

  try {
    // Get all units with their basic user information
    const unitsList = await db
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
        createdAt: units.createdAt,
        updatedAt: units.updatedAt,
        focusAreas: units.focusAreas,
        skillsOffered: units.skillsOffered,
        location: units.location,
        opportunitiesOffered: units.opportunitiesOffered,
        projects: units.projects,
        socialLinks: units.socialLinks,
        // User info
        email: userTable.email,
        userImage: userTable.image,
      })
      .from(units)
      .leftJoin(userTable, eq(units.userId, userTable.id))
      .orderBy(desc(units.createdAt));

    return c.json(
      {
        status_code: OK,
        message: "Units retrieved successfully",
        data: unitsList,
      },
      OK,
    );
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

// GET /units/:id - Get specific unit by ID (candidate only)
export const getUnitById: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  if (user.role !== "candidate") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only candidates can view unit details",
      },
      FORBIDDEN,
    );
  }

  const { id } = c.req.param();

  if (!id) {
    return c.json(
      {
        status_code: UNPROCESSABLE_ENTITY,
        message: "Unit ID is required",
      },
      UNPROCESSABLE_ENTITY,
    );
  }

  try {
    // Get specific unit with user information
    const unitData = await db
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
        createdAt: units.createdAt,
        updatedAt: units.updatedAt,
        focusAreas: units.focusAreas,
        skillsOffered: units.skillsOffered,
        location: units.location,
        opportunitiesOffered: units.opportunitiesOffered,
        projects: units.projects,
        socialLinks: units.socialLinks,
        // User info
        email: userTable.email,
        userImage: userTable.image,
      })
      .from(units)
      .leftJoin(userTable, eq(units.userId, userTable.id))
      .where(eq(units.userId, id))
      .limit(1);

    if (!unitData || unitData.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Unit not found" },
        NOT_FOUND,
      );
    }

    return c.json(
      {
        status_code: OK,
        message: "Unit details retrieved successfully",
        data: unitData[0],
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching unit details:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
