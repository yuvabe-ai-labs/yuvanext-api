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
import {
  imageFileSchema,
  videoFileSchema,
} from "@/lib/services/file-validation";

import { profileResponseSchema, updateProfileSchema } from "./profile.schema";

/**
 * GET /profile - Get user profile
 */
export const getProfile = createRoute({
  method: "get" as const,
  path: "/profile",
  tags: ["Profile"],
  middleware: requireRole({ allowedRoles: ["candidate", "unit", "mentor"] }),
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
  path: "/profile/avatar",
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
            file: imageFileSchema.describe(
              "Avatar image file (PNG, JPG, JPEG, WEBP, max 5MB)",
            ),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        avatarUrl: z.url(),
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
  path: "/profile/banner",
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
            file: imageFileSchema.describe(
              "Banner image file (PNG, JPG, JPEG, WEBP, max 50MB)",
            ),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        bannerUrl: z.url(),
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
  path: "/profile/gallery",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Upload gallery image (Units only)",
  description: "Upload a gallery image to S3 and add to gallery array",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: imageFileSchema.describe(
              "Gallery image file (PNG, JPG, JPEG, WebP, max 5MB)",
            ),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        galleryImageUrl: z.url(),
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
    body: {
      content: {
        "application/json": {
          schema: z.object({
            imageUrl: z.url(),
          }),
        },
      },
    },
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
 * POST /profile/testimonial/presign - Generate presigned URL for testimonial upload (Units only)
 */
export const generateTestimonialUploadUrl = createRoute({
  method: "post" as const,
  path: "/profile/testimonial/presign",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Generate presigned URL for testimonial video upload (Units only)",
  description:
    "Generate a presigned S3 URL for client to upload testimonial video directly to S3.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            fileName: z.string().min(1),
            expiresIn: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        uploadUrl: z.string().url(),
        key: z.string(),
        fileUrl: z.string().url(),
        expiresIn: z.number().optional(),
      }),
    ),
    ...commonErrorResponses,
    [BAD_REQUEST]: createResponse(BAD_REQUEST),
  },
});

/**
 * POST /profile/testimonial/complete - Finalize testimonial upload (Units only)
 */
export const completeTestimonialUpload = createRoute({
  method: "post" as const,
  path: "/profile/testimonial/complete",
  tags: ["Profile", "File Upload"],
  middleware: requireRole({ allowedRoles: ["unit"] }),
  summary: "Finalize testimonial upload (Units only)",
  description:
    "Confirm uploaded testimonial video, replace any existing testimonial video(s) in the unit's galleryVideos, and delete old files from S3.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            key: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    [OK]: createResponse(
      OK,
      z.object({
        galleryVideos: z.array(z.string().url()),
      }),
    ),
    ...crudErrorResponses,
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
    "Delete specific testimonial video from S3 and remove from array. If no videoUrl is provided, deletes existing testimonial(s) for the unit.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            videoUrl: z.string().url().optional(),
          }),
        },
      },
    },
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

/**
 * GET /profile/mentor - Get mentor profile
 */
export const getMentorProfile = createRoute({
  method: "get" as const,
  path: "/profile/mentor",
  tags: ["Profile", "Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "Get mentor profile",
  description: "Retrieve the complete profile for the authenticated mentor",
  responses: {
    [OK]: createResponse(OK, profileResponseSchema),
    ...commonErrorResponses,
    [NOT_FOUND]: createResponse(NOT_FOUND),
  },
});

/**
 * PUT /profile/mentor - Update mentor profile
 */
export const updateMentorProfile = createRoute({
  method: "put" as const,
  path: "/profile/mentor",
  tags: ["Profile", "Mentor"],
  middleware: requireRole({ allowedRoles: ["mentor"] }),
  summary: "Update mentor profile",
  description: "Update profile fields for the authenticated mentor",
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
    [NOT_FOUND]: createResponse(NOT_FOUND),
    ...validationErrorResponses,
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
export type GenerateTestimonialUploadUrl = typeof generateTestimonialUploadUrl;
export type CompleteTestimonialUpload = typeof completeTestimonialUpload;
export type DeleteTestimonialVideo = typeof deleteTestimonialVideo;
export type GetMentorProfile = typeof getMentorProfile;
export type UpdateMentorProfile = typeof updateMentorProfile;
