import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { NOT_FOUND, OK, BAD_REQUEST } from "@/lib/openapi/http-status-codes";
import {
  commonErrorResponses,
  crudErrorResponses,
  createResponse,
  validationErrorResponses,
} from "@/lib/openapi/response-helpers";
import { requireRole } from "@/middleware/auth";

import { profileResponseSchema, updateProfileSchema } from "./profile.schema";

/**
 * GET /profile - Get user profile
 */
export const getProfile = createRoute({
  method: "get" as const,
  path: "/profile",
  tags: ["Profile"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Get user profile",
  description: "Retrieve the complete profile for the authenticated user",
  responses: {
    [OK]: createResponse(OK, profileResponseSchema),
    ...commonErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * PUT /profile - Update user profile
 */
export const updateProfile = createRoute({
  method: "put" as const,
  path: "/profile",
  tags: ["Profile"],
  summary: "Update user profile",
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  description:
    "Update profile fields (partial updates allowed). Accepts different fields based on user type (candidate/unit)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateProfileSchema,
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(OK, updateProfileSchema),
    ...validationErrorResponses,
  },
});

/**
 * POST /profile/upload-avatar - Upload avatar image
 */
export const uploadAvatar = createRoute({
  method: "post" as const,
  path: "/profile/upload-avatar",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Upload avatar image",
  description:
    "Upload avatar image to S3. Automatically deletes old avatar if exists.",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .any()
              .describe("Avatar image file (PNG, JPG, JPEG, WebP, max 5MB)"),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        avatarUrl: z.string().url(),
      }),
    ),
    ...commonErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
  },
});

/**
 * DELETE /profile/avatar - Delete avatar image
 */
export const deleteAvatar = createRoute({
  method: "delete" as const,
  path: "/profile/avatar",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit"] }),
  summary: "Delete avatar image",
  description: "Delete avatar image from S3 and update database",
  responses: {
    [OK]: createResponse(OK),
    ...crudErrorResponses,
  },
});

/**
 * POST /profile/upload-banner - Upload banner image (Units only)
 */
export const uploadBanner = createRoute({
  method: "post" as const,
  path: "/profile/upload-banner",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Upload banner image (Units only)",
  description:
    "Upload banner image to S3. Automatically deletes old banner if exists.",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .any()
              .describe("Banner image file (PNG, JPG, JPEG, WebP, max 5MB)"),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        bannerUrl: z.string().url(),
      }),
    ),
    ...commonErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
  },
});

/**
 * DELETE /profile/banner - Delete banner image (Units only)
 */
export const deleteBanner = createRoute({
  method: "delete" as const,
  path: "/profile/banner",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Delete banner image (Units only)",
  description: "Delete banner image from S3 and update database",
  responses: {
    [OK]: createResponse(OK),
    ...crudErrorResponses,
  },
});

/**
 * POST /profile/upload-gallery - Upload gallery image (Units only)
 */
export const uploadGalleryImage = createRoute({
  method: "post" as const,
  path: "/profile/upload-gallery",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Upload gallery image (Units only)",
  description: "Upload a gallery image to S3 and add to gallery array",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .any()
              .describe("Gallery image file (PNG, JPG, JPEG, WebP, max 5MB)"),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        galleryImageUrl: z.string().url(),
        galleryImages: z.array(z.string().url()),
      }),
    ),
    ...commonErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
  },
});

/**
 * DELETE /profile/gallery - Delete gallery image (Units only)
 */
export const deleteGalleryImage = createRoute({
  method: "delete" as const,
  path: "/profile/gallery",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Delete gallery image (Units only)",
  description: "Delete specific gallery image from S3 and remove from array",
  request: {
    query: z.object({
      imageUrl: z.string().url(),
    }),
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        galleryImages: z.array(z.string().url()),
      }),
    ),
    ...crudErrorResponses,
  },
});

/**
 * POST /profile/upload-testimonial - Upload testimonial video (Units only)
 */
export const uploadTestimonialVideo = createRoute({
  method: "post" as const,
  path: "/profile/upload-testimonial",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Upload testimonial video (Units only)",
  description: "Upload a testimonial video to S3 and add to videos array",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .any()
              .describe("Testimonial video file (MP4, WebM, MOV, max 5MB)"),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        videoUrl: z.url(),
        galleryVideos: z.array(z.string().url()),
      }),
    ),
    ...commonErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
  },
});

/**
 * DELETE /profile/testimonial - Delete testimonial video (Units only)
 */
export const deleteTestimonialVideo = createRoute({
  method: "delete" as const,
  path: "/profile/testimonial",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Delete testimonial video (Units only)",
  description:
    "Delete specific testimonial video from S3 and remove from array",
  request: {
    query: z.object({
      videoUrl: z.string().url(),
    }),
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        galleryVideos: z.array(z.url()),
      }),
    ),
    ...crudErrorResponses,
  },
});

export type GetProfile = typeof getProfile;
export type UpdateProfile = typeof updateProfile;
export type UploadAvatar = typeof uploadAvatar;
export type DeleteAvatar = typeof deleteAvatar;
export type UploadBanner = typeof uploadBanner;
export type DeleteBanner = typeof deleteBanner;
export type UploadGalleryImage = typeof uploadGalleryImage;
export type DeleteGalleryImage = typeof deleteGalleryImage;
export type UploadTestimonialVideo = typeof uploadTestimonialVideo;
export type DeleteTestimonialVideo = typeof deleteTestimonialVideo;
