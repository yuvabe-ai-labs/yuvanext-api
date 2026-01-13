import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import env from "@/config/env";

// Initialize S3 Client
const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});
// Get bucket name based on environment
function getBucketName(): string {
  const bucketMap: Record<string, string> = {
    production: "yuvanext-platform-assets",
    development: "yuvanext-platform-assets-dev",
    staging: "yuvanext-platform-assets-stg",
  };

  return bucketMap[env.NODE_ENV] || "yuvanext-platform-assets-dev";
}

// File type definitions
export type SourceName =
  | "avatar"
  | "banner"
  | "gallery"
  | "testimonial-videos"
  | "profile-image";

export type UserRole = "candidate" | "unit";

/**
 * Generate S3 key based on user role and file type
 */
export function generateS3Key(
  userId: string,
  fileType: SourceName,
  fileName: string,
): string {
  // Generate unique filename to avoid collisions
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const extension = fileName.split(".").pop();
  const uniqueFileName = `${timestamp}-${randomString}.${extension}`;

  // Organize by role and file type
  switch (fileType) {
    case "avatar":
      return `${userId}/avatar/${uniqueFileName}`;
    case "banner":
      return `${userId}/banner/${uniqueFileName}`;
    case "gallery":
      return `${userId}/gallery/${uniqueFileName}`;
    case "testimonial-videos":
      return `${userId}/testimonial-videos/${uniqueFileName}`;
    case "profile-image":
      return `${userId}/profile/${uniqueFileName}`;
    default:
      throw new Error(`Invalid file type: ${fileType}`);
  }
}

/**
 * Upload file to S3
 */
export async function uploadFileToS3(
  file: File | Buffer,
  userId: string,
  fileType: SourceName,
  fileName?: string,
): Promise<string> {
  try {
    const bucket = getBucketName();

    // Get file buffer and metadata
    let fileBuffer: Buffer;
    let contentType: string;
    let originalFileName: string;

    if (file instanceof Buffer) {
      fileBuffer = file;
      contentType = "application/octet-stream";
      originalFileName = fileName || "file";
    } else {
      // Handle File/Blob types (which have arrayBuffer method)
      const fileWithArrayBuffer = file as any;
      fileBuffer = Buffer.from(await fileWithArrayBuffer.arrayBuffer());
      contentType = fileWithArrayBuffer.type || "application/octet-stream";
      originalFileName = fileWithArrayBuffer.name || fileName || "file";
    }

    // Generate S3 key
    const key = generateS3Key(userId, fileType, originalFileName);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Return the public URL
    const url = `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw new Error("Failed to upload file to S3");
  }
}

/**
 * Delete file from S3
 */
export async function deleteFileFromS3(fileUrl: string): Promise<void> {
  try {
    const bucket = getBucketName();

    // Extract key from URL
    const key = extractKeyFromUrl(fileUrl, bucket);

    if (!key) {
      throw new Error("Invalid S3 URL");
    }

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw new Error("Failed to delete file from S3");
  }
}

/**
 * Delete multiple files from S3
 */
export async function deleteMultipleFilesFromS3(
  fileUrls: string[],
): Promise<void> {
  try {
    const bucket = getBucketName();

    // Extract keys from URLs
    const keys = fileUrls
      .map((url) => extractKeyFromUrl(url, bucket))
      .filter((key): key is string => key !== null);

    if (keys.length === 0) {
      return;
    }

    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting multiple files from S3:", error);
    throw new Error("Failed to delete files from S3");
  }
}

/**
 * Extract S3 key from URL
 */
function extractKeyFromUrl(url: string, bucket: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname.startsWith(bucket)) {
      // Format 1
      return urlObj.pathname.substring(1); // Remove leading slash
    } else if (hostname.startsWith("s3")) {
      // Format 2
      const pathParts = urlObj.pathname.split("/");
      if (pathParts[1] === bucket) {
        return pathParts.slice(2).join("/");
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting key from URL:", error);
    return null;
  }
}

/**
 * Generate presigned URL for direct upload (optional - for client-side uploads)
 */
export async function generatePresignedUploadUrl(
  userId: string,
  fileType: SourceName,
  fileName: string,
  expiresIn: number = 3600,
): Promise<{ url: string; key: string }> {
  try {
    const bucket = getBucketName();
    const key = generateS3Key(userId, fileType, fileName);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return { url, key };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error("Failed to generate presigned URL");
  }
}

/**
 * Clean up old files when updating
 * This function should be called before uploading new files
 */
export async function cleanupOldFile(
  oldUrl: string | null | undefined,
): Promise<void> {
  if (oldUrl) {
    try {
      await deleteFileFromS3(oldUrl);
    } catch (error) {
      // Log but don't throw - we don't want to fail the update if cleanup fails
      console.error("Error cleaning up old file:", error);
    }
  }
}

/**
 * Clean up old files from array (for gallery images/videos)
 */
export async function cleanupOldFiles(
  oldUrls: string[] | null | undefined,
): Promise<void> {
  if (oldUrls && oldUrls.length > 0) {
    try {
      await deleteMultipleFilesFromS3(oldUrls);
    } catch (error) {
      // Log but don't throw
      console.error("Error cleaning up old files:", error);
    }
  }
}
