/**
 * File validation utilities for uploads
 */
import { z } from "zod";

const MAX_FILE_SIZE_IMAGE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE_VIDEO = 50 * 1024 * 1024; // 50MB

export const ALLOWED_IMAGE_TYPES = ["image/jpg", "image/png"];

export const ALLOWED_VIDEO_TYPES = ["video/mp4"];

/**
 * Zod schema for image file upload
 * Validates file type and size using refine()
 * Uses z.any() with .openapi() metadata for proper schema generation
 */
export const imageFileSchema = z
  .any()
  .refine(
    (file: unknown) => {
      if (!(file instanceof File)) return false;
      return ALLOWED_IMAGE_TYPES.includes(file.type);
    },
    {
      message: "Invalid image format. Allowed formats: PNG, JPG",
    },
  )
  .refine(
    (file: unknown) => {
      if (!(file instanceof File)) return false;
      return file.size <= MAX_FILE_SIZE_IMAGE;
    },
    {
      message: "File size exceeds 5MB limit",
    },
  )
  .openapi({
    type: "string",
    format: "binary",
    description: "Image file (PNG, JPG) - max 5MB",
  });

/**
 * Zod schema for video file upload
 * Validates file type and size using refine()
 * Uses z.any() with .openapi() metadata for proper schema generation
 */
export const videoFileSchema = z
  .any()
  .refine(
    (file: unknown) => {
      if (!(file instanceof File)) return false;
      return ALLOWED_VIDEO_TYPES.includes(file.type);
    },
    {
      message: "Invalid video format. Allowed formats: MP4",
    },
  )
  .refine(
    (file: unknown) => {
      if (!(file instanceof File)) return false;
      return file.size <= MAX_FILE_SIZE_VIDEO;
    },
    {
      message: "File size exceeds 50MB limit",
    },
  )
  .openapi({
    type: "string",
    format: "binary",
    description: "Video file (MP4) - max 50MB",
  });
