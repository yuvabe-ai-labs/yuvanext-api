import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { applications } from "@/db/schema/application.schema";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { internships } from "@/db/schema/internship.schema";
import { interviews } from "@/db/schema/interview.schema";
import { notifications } from "@/db/schema/notification.schema";
import { userSettings } from "@/db/schema/settings.schema";
import { units } from "@/db/schema/unit.schema";
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";
import {
  sendApplicationEmail,
  sendUnitInterviewEmail,
} from "@/lib/services/email.service";
import { createZoomMeeting } from "@/lib/services/zoom.service";

import type {
  GetApplicationById,
  GetApplications,
  GetApplicationsByInternshipId,
  UpdateApplicationStatus,
  GetCandidateProfileById,
} from "./actions.routes";

// Helper function to check if email notifications are enabled for a user
async function isEmailNotificationsEnabled(userId: string): Promise<boolean> {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Default to true if no settings found (backward compatibility)
    return settings?.emailNotificationsEnabled ?? true;
  } catch (err) {
    console.error("Error checking email notification settings:", err);
    // Default to true on error to maintain existing behavior
    return true;
  }
}

// Helper function to check if in-app notifications are enabled for a user
async function isInAppNotificationsEnabled(userId: string): Promise<boolean> {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Default to true if no settings found (backward compatibility)
    return settings?.inAppNotificationsEnabled ?? true;
  } catch (err) {
    console.error("Error checking in-app notification settings:", err);
    // Default to true on error to maintain existing behavior
    return true;
  }
}

// Helper function to create notification (with settings check)
async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "success" | "info" | "warning" | "error" = "info",
) {
  // Check if in-app notifications are enabled
  const inAppEnabled = await isInAppNotificationsEnabled(userId);

  if (!inAppEnabled) {
    console.log(
      `In-app notifications disabled for user ${userId}, skipping notification creation`,
    );
    return;
  }

  await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
    isRead: false,
  });
}

// Helper function to determine interview provider
function determineInterviewProvider(
  meetingLink?: string,
): "zoom" | "google_meet" | "teams" | "other" {
  if (!meetingLink) return "other";

  const link = meetingLink.toLowerCase();
  if (link.includes("zoom.us")) return "zoom";
  if (link.includes("meet.google.com")) return "google_meet";
  if (link.includes("teams.microsoft.com") || link.includes("teams.live.com"))
    return "teams";

  return "other";
}

// GET /applications - Get all applications for unit's internships
// PUT /applications/status - Update application status
export const updateApplicationStatus: AppRouteHandler<
  UpdateApplicationStatus
> = async (c) => {
  const user = c.get("user");

  try {
    const { applicationId, status, interviewDetails } = c.req.valid("json");

    // Get application with related data INCLUDING unit name in one query
    const applicationData = await db
      .select({
        application: applications,
        internship: internships,
        candidate: candidates,
        candidateUser: userTable,
        unitName: units.name, // Fetch unit name here to avoid extra DB call
      })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(candidates, eq(applications.userId, candidates.userId))
      .innerJoin(userTable, eq(applications.userId, userTable.id))
      .innerJoin(units, eq(internships.createdBy, units.userId)) // Join units table
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!applicationData || applicationData.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Application not found",
        },
        NOT_FOUND,
      );
    }

    const {
      application: _application,
      internship,
      candidate: _candidate,
      candidateUser,
      unitName, // Extract unit name from the query result
    } = applicationData[0];

    // Verify the internship belongs to this unit
    if (internship.createdBy !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only update applications for your own internships",
        },
        FORBIDDEN,
      );
    }

    // Check notification settings for both candidate and unit
    const [candidateEmailEnabled, unitEmailEnabled] = await Promise.all([
      isEmailNotificationsEnabled(candidateUser.id),
      isEmailNotificationsEnabled(user.id),
    ]);

    // Update application status
    const [updatedApplication] = await db
      .update(applications)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId))
      .returning();

    // Prepare notification and email content based on status
    let notificationTitle = "";
    let notificationMessage = "";
    let notificationType: "success" | "info" | "warning" | "error" = "info";

    // Keep interview scheduling data available outside switch
    let zoomLink: string | undefined;
    let scheduledAt: string | undefined;
    let interviewRecord:
      | (typeof interviews.$inferSelect & { id: string })
      | undefined;

    switch (status) {
      case "shortlisted":
        notificationTitle = "Application Shortlisted!";
        notificationMessage = `Your application for "${internship.title}" has been shortlisted. The employer will contact you soon.`;
        notificationType = "success";
        break;

      case "not_shortlisted":
        notificationTitle = "Application Update";
        notificationMessage = `Thank you for your interest in "${internship.title}". Unfortunately, we are moving forward with other candidates.`;
        notificationType = "info";
        break;

      case "interviewed": {
        const meetingLink = interviewDetails?.meetingLink;
        scheduledAt = interviewDetails?.scheduledAt;

        // Schedule Zoom meeting if scheduledAt provided and no manual link
        zoomLink = meetingLink;
        let provider = interviewDetails?.provider;

        if (scheduledAt && !meetingLink) {
          const zoomMeeting = await createZoomMeeting({
            topic: `Interview: ${internship.title} - ${candidateUser.name}`,
            startTime: scheduledAt,
            duration: interviewDetails?.durationMinutes || 60,
            attendeeEmail: candidateUser.email,
            attendeeName: candidateUser.name,
          });

          if (zoomMeeting) {
            zoomLink = zoomMeeting.joinUrl;
            provider = "zoom";
          }
        } else if (zoomLink && !provider) {
          // Auto-detect provider from link if not specified
          provider = determineInterviewProvider(zoomLink);
        }

        // Store interview details in interviews table
        if (scheduledAt) {
          const [newInterview] = await db
            .insert(interviews)
            .values({
              applicationId,
              scheduledDate: new Date(scheduledAt),
              durationMinutes: interviewDetails?.durationMinutes || 60,
              link: zoomLink || null,
              title: `Interview: ${internship.title} - ${candidateUser.name}`,
              description: interviewDetails?.notes || null,
              provider: provider || "other",
            })
            .returning();

          interviewRecord = newInterview;
        }

        notificationTitle = "Interview Scheduled!";
        notificationMessage = `Your interview for "${internship.title}" has been scheduled. ${scheduledAt ? `Time: ${new Date(scheduledAt).toLocaleString()}` : ""} ${zoomLink ? `Meeting Link: ${zoomLink}` : ""}`;
        notificationType = "success";
        break;
      }

      case "hired":
        notificationTitle = "Congratulations! You're Hired!";
        notificationMessage = `Congratulations! You have been selected for "${internship.title}". We will send you the offer letter shortly.`;
        notificationType = "success";
        break;

      case "applied":
        notificationTitle = "Application Received";
        notificationMessage = `Your application for "${internship.title}" has been received.`;
        notificationType = "info";
        break;
    }

    // Create notification for candidate (with settings check)
    await createNotification(
      candidateUser.id,
      notificationTitle,
      notificationMessage,
      notificationType,
    );

    // Use unit name from initial query (no extra DB call needed!)
    const finalUnitName = unitName ?? "the organization";

    // Send email to candidate (only if enabled)
    let candidateEmailSent = false;
    if (candidateEmailEnabled) {
      candidateEmailSent = await sendApplicationEmail(status, {
        to: candidateUser.email,
        candidateName: candidateUser.name,
        internshipTitle: internship.title,
        unitName: finalUnitName,
        additionalData: {
          meetingLink: status === "interviewed" ? zoomLink : undefined,
          scheduledAt: status === "interviewed" ? scheduledAt : undefined,
          notes: interviewDetails?.notes,
        },
      });
    }

    // Send email to unit if status is interviewed (only if enabled)
    let unitEmailSent = false;
    if (status === "interviewed" && unitEmailEnabled) {
      unitEmailSent = await sendUnitInterviewEmail({
        to: user.email, // Unit's email
        unitName: finalUnitName,
        candidateName: candidateUser.name,
        candidateEmail: candidateUser.email,
        internshipTitle: internship.title,
        additionalData: {
          meetingLink: zoomLink,
          scheduledAt,
          notes: interviewDetails?.notes,
        },
      });
    }

    return c.json(
      {
        status_code: OK,
        message: "Application status updated successfully",
        data: {
          application: {
            id: updatedApplication.id,
            status: updatedApplication.status,
            updatedAt: updatedApplication.updatedAt,
          },
          interview: status === "interviewed" ? interviewRecord : undefined,
          notificationSent: true,
          candidateEmailSent,
          unitEmailSent: status === "interviewed" ? unitEmailSent : undefined,
        },
      },
      OK,
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Invalid request data",
          errors: err.issues,
        },
        BAD_REQUEST,
      );
    }

    console.error("Error updating application status:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

export const getUnitApplications: AppRouteHandler<GetApplications> = async (
  c,
) => {
  const user = c.get("user");
  try {
    // Get all internships created by this unit with their applications
    const applicationsData = await db
      .select({
        // Application fields (will be null if no application exists)
        applicationId: applications.id,
        applicationStatus: applications.status,
        applicationCreatedAt: applications.createdAt,
        applicationUpdatedAt: applications.updatedAt,
        profileScore: applications.profileScore,
        candidateOfferDecision: applications.candidateOfferDecision,

        // Internship fields
        internshipId: internships.id,
        internshipTitle: internships.title,
        internshipType: internships.jobType,
        internshipDuration: internships.duration,

        // Candidate fields (will be null if no application exists)
        candidateUserId: candidates.userId,
        candidateType: candidates.type,
        candidateLocation: candidates.location,
        candidatePhone: candidates.phone,
        candidateAvatarUrl: candidates.avatarUrl,
        candidateSkills: candidates.skills,
        candidateExperienceLevel: candidates.experienceLevel,
        candidateProfileSummary: candidates.profileSummary,
        candidateInterests: candidates.interests,
        candidateEducation: candidates.education,
        candidateCourse: candidates.course,
        candidateSocialLinks: candidates.socialLinks,
        candidateInternship: candidates.internship,
        candidateProjects: candidates.projects,

        // User fields (will be null if no application exists)
        userName: userTable.name,
        userEmail: userTable.email,
        userImage: userTable.image,
      })
      .from(internships)
      .leftJoin(applications, eq(applications.internshipId, internships.id)) // Changed to leftJoin
      .leftJoin(candidates, eq(applications.userId, candidates.userId)) // Changed to leftJoin
      .leftJoin(userTable, eq(applications.userId, userTable.id)) // Changed to leftJoin
      .where(eq(internships.createdBy, user.id))
      .orderBy(desc(applications.createdAt));

    console.log(`Found ${applicationsData.length} records for unit ${user.id}`);

    // Filter out internships without applications and format the response
    const formattedApplications = applicationsData
      .filter((app) => app.applicationId !== null) // Only include rows with actual applications
      .map((app) => ({
        application: {
          id: app.applicationId!,
          status: app.applicationStatus!,
          createdAt: app.applicationCreatedAt!,
          updatedAt: app.applicationUpdatedAt!,
          candidateOfferDecision: app.candidateOfferDecision,
        },
        internship: {
          id: app.internshipId,
          title: app.internshipTitle,
          type: app.internshipType,
        },
        candidate: {
          userId: app.candidateUserId!,
          name: app.userName!,
          avatarUrl: app.candidateAvatarUrl,
          skills: app.candidateSkills!,
          profileSummary: app.candidateProfileSummary!,
          interests: app.candidateInterests!,
        },
      }));

    return c.json(
      {
        status_code: OK,
        message: "Applications retrieved successfully",
        data: formattedApplications,
        total: formattedApplications.length,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching unit applications:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /applications/:applicationId - Get specific application for unit's internships
export const getUnitApplicationById: AppRouteHandler<
  GetApplicationById
> = async (c) => {
  const user = c.get("user");
  const applicationId = c.req.param("applicationId");

  try {
    // Get the specific application with related data
    const applicationData = await db
      .select({
        // Application fields
        applicationId: applications.id,
        applicationStatus: applications.status,
        applicationCreatedAt: applications.createdAt,
        applicationUpdatedAt: applications.updatedAt,
        profileScore: applications.profileScore,
        candidateOfferDecision: applications.candidateOfferDecision,

        // Internship fields
        internshipId: internships.id,
        internshipTitle: internships.title,
        internshipType: internships.jobType,
        internshipDuration: internships.duration,
        internshipCreatedBy: internships.createdBy,

        // Candidate fields
        candidateUserId: candidates.userId,
        candidateType: candidates.type,
        candidateLocation: candidates.location,
        candidatePhone: candidates.phone,
        candidateAvatarUrl: candidates.avatarUrl,
        candidateSkills: candidates.skills,
        candidateExperienceLevel: candidates.experienceLevel,
        candidateProfileSummary: candidates.profileSummary,
        candidateInterests: candidates.interests,
        candidateEducation: candidates.education,
        candidateCourse: candidates.course,
        candidateSocialLinks: candidates.socialLinks,
        candidateInternship: candidates.internship,
        candidateProjects: candidates.projects,

        // User fields
        userName: userTable.name,
        userEmail: userTable.email,
      })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(candidates, eq(applications.userId, candidates.userId))
      .innerJoin(userTable, eq(applications.userId, userTable.id))
      .where(eq(applications.id, applicationId));

    if (applicationData.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Application not found",
        },
        NOT_FOUND,
      );
    }

    const app = applicationData[0];

    // Permission check: only unit/admin who created the internship or any mentor can view
    if (user.role === "unit" || user.role === "admin") {
      if (app.internshipCreatedBy !== user.id) {
        return c.json(
          {
            status_code: FORBIDDEN,
            message: "You can only view applications for your own internships",
          },
          FORBIDDEN,
        );
      }
    }
    // Mentors can view any candidate's application details

    const formattedApplications = applicationData.map((app) => ({
      application: {
        id: app.applicationId,
        status: app.applicationStatus,
        candidateOfferDecision: app.candidateOfferDecision,
        createdAt: app.applicationCreatedAt,
        updatedAt: app.applicationUpdatedAt,
      },
      internship: {
        id: app.internshipId,
        title: app.internshipTitle,
        type: app.internshipType,
        duration: app.internshipDuration,
      },
      candidate: {
        userId: app.candidateUserId,
        name: app.userName,
        avatarUrl: app.candidateAvatarUrl,
        skills: app.candidateSkills,
        profileSummary: app.candidateProfileSummary,
        interests: app.candidateInterests,
        email: app.userEmail,
        type: app.candidateType,
        location: app.candidateLocation,
        phone: app.candidatePhone,
        experienceLevel: app.candidateExperienceLevel,
        education: app.candidateEducation,
        course: app.candidateCourse,
        socialLinks: app.candidateSocialLinks,
        internship: app.candidateInternship,
        projects: app.candidateProjects,
      },
    }));

    return c.json(
      {
        status_code: OK,
        message: "Application retrieved successfully",
        data: formattedApplications[0],
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching unit application by ID:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /applications/internship/:internshipId - Get all applications for a specific internship
export const getApplicationsByInternshipId: AppRouteHandler<
  GetApplicationsByInternshipId
> = async (c) => {
  const user = c.get("user");
  const internshipId = c.req.param("internshipId");

  try {
    // First verify that the internship belongs to this unit
    const [internship] = await db
      .select()
      .from(internships)
      .where(eq(internships.id, internshipId))
      .limit(1);

    if (!internship) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Internship not found",
        },
        NOT_FOUND,
      );
    }

    if (internship.createdBy !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only view applications for your own internships",
        },
        FORBIDDEN,
      );
    }

    // Get all applications for this internship
    const applicationsData = await db
      .select({
        applicationId: applications.id,
        applicationStatus: applications.status,
        candidateName: userTable.name,
        candidateAvatarUrl: candidates.avatarUrl,
        profileSummary: candidates.profileSummary,
        candidateSkills: candidates.skills,
        candidateInterests: candidates.interests,
        internshipTitle: internships.title,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
      })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(candidates, eq(applications.userId, candidates.userId))
      .innerJoin(userTable, eq(applications.userId, userTable.id))
      .where(eq(applications.internshipId, internshipId))
      .orderBy(desc(applications.createdAt));

    const formattedApplications = applicationsData.map((app) => ({
      applicationId: app.applicationId,
      candidateName: app.candidateName,
      candidateAvatarUrl: app.candidateAvatarUrl,
      internshipTitle: app.internshipTitle,
      status: app.applicationStatus,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      profileSummary: app.profileSummary,
      candidateSkills: app.candidateSkills,
      candidateInterests: app.candidateInterests,
    }));

    return c.json(
      {
        status_code: OK,
        message: "Applications retrieved successfully",
        data: formattedApplications,
        total: formattedApplications.length,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching applications by internship ID:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /candidates/:candidateId - Get candidate profile without application (for mentors)
export const getCandidateProfileById: AppRouteHandler<
  GetCandidateProfileById
> = async (c) => {
  const candidateId = c.req.param("candidateId");

  try {
    // Fetch candidate profile data
    const candidateData = await db
      .select({
        userId: candidates.userId,
        name: userTable.name,
        email: userTable.email,
        avatarUrl: candidates.avatarUrl,
        skills: candidates.skills,
        profileSummary: candidates.profileSummary,
        interests: candidates.interests,
        location: candidates.location,
        phone: candidates.phone,
        experienceLevel: candidates.experienceLevel,
        education: candidates.education,
        course: candidates.course,
        socialLinks: candidates.socialLinks,
        internship: candidates.internship,
        projects: candidates.projects,
      })
      .from(candidates)
      .innerJoin(userTable, eq(candidates.userId, userTable.id))
      .where(eq(candidates.userId, candidateId));

    if (candidateData.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Candidate not found",
        },
        NOT_FOUND,
      );
    }

    const candidate = candidateData[0];

    return c.json(
      {
        status_code: OK,
        message: "Candidate profile retrieved successfully",
        data: candidate,
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching candidate profile by ID:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
