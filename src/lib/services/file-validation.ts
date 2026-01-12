/**
 * File validation utilities for uploads
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // MOV
];

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

/**
 * Validate image file
 * @param file - File object to validate
 * @throws FileValidationError if validation fails
 */
export async function validateImageFile(file: File): Promise<void> {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new FileValidationError(
      `Invalid image format. Allowed formats: PNG, JPG, JPEG, WebP`,
    );
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `File size exceeds 5MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
    );
  }
}

/**
 * Validate video file
 * @param file - File object to validate
 * @throws FileValidationError if validation fails
 */
export async function validateVideoFile(file: File): Promise<void> {
  // Check file type
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new FileValidationError(
      `Invalid video format. Allowed formats: MP4, WebM, MOV`,
    );
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `File size exceeds 5MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
    );
  }
}
