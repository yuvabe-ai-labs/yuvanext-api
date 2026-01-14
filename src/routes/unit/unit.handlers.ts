import { desc, eq } from "drizzle-orm";
import { internships } from "@/db/schema/internship.schema";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { units } from "@/db/schema/unit.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type { GetAllUnits, GetUnitById } from "./unit.routes";

// GET /units - Get all units (candidate only)
export const getAllUnits: AppRouteHandler<GetAllUnits> = async (c) => {
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
export const getUnitById: AppRouteHandler<GetUnitById> = async (c) => {
  const { id } = c.req.valid("param");

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
        accountStatus: userTable.accountDisabled,
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

    // Fetch only active internships created by this unit
    const unitInternships = await db
      .select({
        id: internships.id,
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
      })
      .from(internships)
      .where(eq(internships.createdBy, id))
      .orderBy(desc(internships.createdAt));

    // Filter for active internships only and add isOpen field
    const activeInternships = unitInternships
      .filter((internship) => internship.status === "active")
      .map((internship) => ({
        ...internship,
        isOpen: true,
      }));

    return c.json(
      {
        status_code: OK,
        message: "Unit details retrieved successfully",
        data: {
          ...unitData[0],
          internships: activeInternships,
        },
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
