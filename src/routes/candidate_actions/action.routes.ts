import { z } from "zod";

import { createRouter } from "@/lib/create-app";
import {
  CREATED,
  INTERNAL_SERVER_ERROR,
  OK,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./action.handlers";

const router = createRouter();
router.use(requireAuth);

// Save internship
router.openapi(
  {
    method: "post",
    path: "internship/save",
    tags: ["InternshipActions"],
    summary: "Save an internship",
    security: [{ Bearer: [] }],
    requestBody: {
      content: {
        "application/json": {
          schema: z.object({ internshipId: z.uuid() }),
        },
      },
    },
    responses: {
      [CREATED]: { description: "Saved" },
      [OK]: { description: "Already saved" },
      [UNAUTHORIZED]: { description: "Unauthorized" },
      [INTERNAL_SERVER_ERROR]: { description: "Internal server error" },
    },
  },
  handlers.saveInternship,
);

// Remove saved internship
router.openapi(
  {
    method: "delete",
    path: "internship/save",
    tags: ["InternshipActions"],
    summary: "Remove saved internship",
    security: [{ Bearer: [] }],
    requestBody: {
      content: {
        "application/json": {
          schema: z.object({ internshipId: z.uuid() }),
        },
      },
    },
    responses: {
      [OK]: { description: "Removed" },
      [UNAUTHORIZED]: { description: "Unauthorized" },
      [INTERNAL_SERVER_ERROR]: { description: "Internal server error" },
    },
  },
  handlers.removeSavedInternship,
);

// Apply to internship
router.openapi(
  {
    method: "post",
    path: "internship/apply",
    tags: ["InternshipActions"],
    summary: "Apply to an internship",
    security: [{ Bearer: [] }],
    requestBody: {
      content: {
        "application/json": {
          schema: z.object({
            internshipId: z.uuid(),
            includedSections: z.array(z.string()).optional(),
          }),
        },
      },
    },
    responses: {
      [CREATED]: { description: "Applied" },
      [OK]: { description: "Already applied" },
      [UNAUTHORIZED]: { description: "Unauthorized" },
      [INTERNAL_SERVER_ERROR]: { description: "Internal server error" },
    },
  },
  handlers.applyToInternship,
);

// Get saved internships
router.openapi(
  {
    method: "get",
    path: "internship/saved",
    tags: ["InternshipActions"],
    summary: "Get saved internships",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: { description: "Saved internships" },
      [UNAUTHORIZED]: { description: "Unauthorized" },
      [INTERNAL_SERVER_ERROR]: { description: "Internal server error" },
    },
  },
  handlers.getSavedInternships,
);

// Get applied internships
router.openapi(
  {
    method: "get",
    path: "internship/applied",
    tags: ["InternshipActions"],
    summary: "Get applied internships",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: { description: "Applications" },
      [UNAUTHORIZED]: { description: "Unauthorized" },
      [INTERNAL_SERVER_ERROR]: { description: "Internal server error" },
    },
  },
  handlers.getAppliedInternships,
);

// Get counts
router.openapi(
  {
    method: "get",
    path: "internship/counts",
    tags: ["InternshipActions"],
    summary: "Get count of saved and applied internships",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: { description: "Counts" },
      [UNAUTHORIZED]: { description: "Unauthorized" },
      [INTERNAL_SERVER_ERROR]: { description: "Internal server error" },
    },
  },
  handlers.getCounts,
);

// Share internship
router.openapi(
  {
    method: "get",
    path: "internship/share/:id",
    tags: ["InternshipActions"],
    summary: "Generate share links for an internship",
    security: [{ Bearer: [] }],
    responses: {
      [OK]: { description: "Share links" },
      [UNAUTHORIZED]: { description: "Unauthorized" },
      [INTERNAL_SERVER_ERROR]: { description: "Internal server error" },
    },
  },
  handlers.shareInternship,
);

export default router;
