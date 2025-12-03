import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { applications } from "@/db/schema/application.schemas";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schemas";
import { internships } from "@/db/schema/internship.schemas";
import { interviews } from "@/db/schema/interview.schemas";
import { notifications } from "@/db/schema/notification.schemas";
import { units } from "@/db/schema/unit.schemas";
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

// GET /unit-actions/applications - Get all applications for unit's internships
export const getUnitApplications: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  // Check if user is a unit
  if (user.role !== "unit") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only units can access this endpoint",
      },
      FORBIDDEN,
    );
  }

  try {
    // Verify unit exists
    const unitData = await db
      .select()
      .from(units)
      .where(eq(units.userId, user.id))
      .limit(1);

    if (!unitData || unitData.length === 0) {
      return c.json(
        { status_code: NOT_FOUND, message: "Unit profile not found" },
        NOT_FOUND,
      );
    }

    // Get all internships created by this unit
    const unitInternships = await db
      .select({ id: internships.id })
      .from(internships)
      .where(eq(internships.createdBy, user.id));

    if (unitInternships.length === 0) {
      return c.json(
        {
          status_code: OK,
          message: "No internships found for this unit",
          data: [],
        },
        OK,
      );
    }

    const _internshipIds = unitInternships.map((i) => i.id);

    // Get all applications for these internships with related data
    const applicationsData = await db
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
        userImage: userTable.image,
      })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(candidates, eq(applications.userId, candidates.userId))
      .innerJoin(userTable, eq(applications.userId, userTable.id))
      .where(eq(internships.createdBy, user.id))
      .orderBy(desc(applications.createdAt));

    // Format the response
    const formattedApplications = applicationsData.map((app) => ({
      application: {
        id: app.applicationId,
        status: app.applicationStatus,
        profileScore: app.profileScore,
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
        email: app.userEmail,
        image: app.userImage,
        avatarUrl: app.candidateAvatarUrl,
        type: app.candidateType,
        location: app.candidateLocation,
        phone: app.candidatePhone,
        skills: app.candidateSkills,
        experienceLevel: app.candidateExperienceLevel,
        profileSummary: app.candidateProfileSummary,
        interests: app.candidateInterests,
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

export const updateApplicationStatusSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum([
    "applied",
    "shortlisted",
    "rejected",
    "interviewed",
    "hired",
  ]),
  interviewDetails: z
    .object({
      scheduledAt: z.string().datetime().optional(),
      meetingLink: z.string().url().optional(),
      notes: z.string().optional(),
      durationMinutes: z.number().int().positive().optional().default(60),
      provider: z.enum(["zoom", "google_meet", "teams", "other"]).optional(),
    })
    .optional(),
});

// Helper function to create notification
async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "success" | "info" | "warning" | "error" = "info",
) {
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

// PUT /unit-actions/applications/status - Update application status
export const updateApplicationStatus: AppRouteHandler<any> = async (c) => {
  const user = c.get("user");

  // Check if user is a unit
  if (user.role !== "unit") {
    return c.json(
      {
        status_code: FORBIDDEN,
        message: "Only units can update application status",
      },
      FORBIDDEN,
    );
  }

  try {
    const body = await c.req.json();
    const validatedData = updateApplicationStatusSchema.parse(body);
    const { applicationId, status, interviewDetails } = validatedData;

    // Get application with related data
    const applicationData = await db
      .select({
        application: applications,
        internship: internships,
        candidate: candidates,
        candidateUser: userTable,
      })
      .from(applications)
      .innerJoin(internships, eq(applications.internshipId, internships.id))
      .innerJoin(candidates, eq(applications.userId, candidates.userId))
      .innerJoin(userTable, eq(applications.userId, userTable.id))
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
    let _emailSubject = "";
    let _emailBody = "";
    let notificationType: "success" | "info" | "warning" | "error" = "info";

    // Keep interview scheduling data available outside switch
    let zoomLink: string | undefined;
    let scheduledAt: string | undefined;
    let interviewRecord: any = null;

    switch (status) {
      case "shortlisted":
        notificationTitle = "Application Shortlisted! 🎉";
        notificationMessage = `Your application for "${internship.title}" has been shortlisted. The employer will contact you soon.`;
        _emailSubject = `Great News! You've been shortlisted for ${internship.title}`;
        _emailBody = `Congratulations! Your application has been shortlisted.`;
        notificationType = "success";
        break;

      case "rejected":
        notificationTitle = "Application Update";
        notificationMessage = `Thank you for your interest in "${internship.title}". Unfortunately, we are moving forward with other candidates.`;
        _emailSubject = `Application Update - ${internship.title}`;
        _emailBody = `Thank you for your interest. We have decided to move forward with other candidates.`;
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
              link: zoomLink,
              title: `Interview: ${internship.title} - ${candidateUser.name}`,
              description: interviewDetails?.notes || null,
              provider: provider || "other",
            })
            .returning();

          interviewRecord = newInterview;
        }

        notificationTitle = "Interview Scheduled! 📅";
        notificationMessage = `Your interview for "${internship.title}" has been scheduled. ${scheduledAt ? `Time: ${new Date(scheduledAt).toLocaleString()}` : ""} ${zoomLink ? `Meeting Link: ${zoomLink}` : ""}`;
        _emailSubject = `Interview Scheduled - ${internship.title}`;
        _emailBody = `Your interview has been scheduled. Meeting details: ${zoomLink}`;
        notificationType = "success";
        break;
      }

      case "hired":
        notificationTitle = "Congratulations! You're Hired! 🎊";
        notificationMessage = `Congratulations! You have been selected for "${internship.title}". We will send you the offer letter shortly.`;
        _emailSubject = `Congratulations! Offer Letter - ${internship.title}`;
        _emailBody = `We are pleased to offer you the position. Offer letter attached.`;
        notificationType = "success";
        break;

      case "applied":
        notificationTitle = "Application Received";
        notificationMessage = `Your application for "${internship.title}" has been received.`;
        _emailSubject = `Application Received - ${internship.title}`;
        _emailBody = `We have received your application and will review it shortly.`;
        notificationType = "info";
        break;
    }

    // Create notification for candidate
    await createNotification(
      candidateUser.id,
      notificationTitle,
      notificationMessage,
      notificationType,
    );

    // Fetch unit details for emails
    const unitRecord = await db
      .select({ name: units.name })
      .from(units)
      .where(eq(units.userId, user.id))
      .limit(1);

    const unitName = unitRecord?.[0]?.name ?? "the organization";

    // Send email to candidate
    const candidateEmailSent = await sendApplicationEmail(status, {
      to: candidateUser.email,
      candidateName: candidateUser.name,
      internshipTitle: internship.title,
      unitName,
      additionalData: {
        meetingLink: status === "interviewed" ? zoomLink : undefined,
        scheduledAt: status === "interviewed" ? scheduledAt : undefined,
        notes: interviewDetails?.notes,
      },
    });

    // Send email to unit if status is interviewed
    let unitEmailSent = false;
    if (status === "interviewed") {
      unitEmailSent = await sendUnitInterviewEmail({
        to: user.email, // Unit's email
        unitName,
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
          application: updatedApplication,
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
