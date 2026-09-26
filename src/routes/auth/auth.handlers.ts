import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { candidates } from "@/db/schema/candidate.schema";
import { invitations } from "@/db/schema/invitation.schema";
import { mentors } from "@/db/schema/mentor.schema";
import { units } from "@/db/schema/unit.schema";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  CREATED,
  BAD_REQUEST,
  UNAUTHORIZED,
} from "@/lib/openapi/http-status-codes";
import { auth } from "@/config/auth";
import { updateUserRoleOnEmailVerification } from "./auth.service";

// Type definitions for the request/response
interface AcceptInvitationRequest {
  invitationId: string;
  password: string;
}

interface InvitationMetadata {
  companyName?: string;
  companyType?: string;
  contactNumber?: string;
  industryType?: string;
  address?: string;
  aboutCompany?: string;
  serviceOffered?: string;
  achievements?: string;
  [key: string]: any;
}

// POST /auth/accept-invitation - Accept invitation and create account with password
export const acceptInvitation = async (c: any): Promise<Response> => {
  try {
    const body = (await c.req.json()) as AcceptInvitationRequest;
    const { invitationId, password } = body;

    if (!invitationId || !password) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Invitation ID and password are required",
        },
        BAD_REQUEST,
      );
    }

    // Verify invitation ID exists and is valid
    const invitation = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (!invitation || invitation.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Invalid invitation ID",
        },
        NOT_FOUND,
      );
    }

    const inv = invitation[0];
    const metadata = (inv.metadata as InvitationMetadata) || {};

    let newUser: any;

    try {
      // Create user account using Better Auth with email from invitation
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: inv.email, // Email comes from invitation, not user input
          password: password,
          name: metadata.companyName || inv.email.split("@")[0],
          metadata: {
            role: "unit",
            invitedByAdmin: true,
          },
        },
      });

      newUser = signUpResult.user;
    } catch (signUpErr: any) {
      console.error("Error signing up user:", signUpErr);
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: signUpErr.message || "Failed to create user account",
        },
        BAD_REQUEST,
      );
    }

    // Use transaction to update user, create unit profile, and update invitation
    try {
      await db.transaction(async (tx) => {
        // Set email as verified and assign unit role
        await tx
          .update(userTable)
          .set({
            emailVerified: true,
            role: "unit",
          })
          .where(eq(userTable.id, newUser.id));

        // Create the unit profile
        await tx.insert(units).values({
          userId: newUser.id,
          name: metadata.companyName || "",
          type: metadata.companyType || "",
          phone: metadata.contactNumber || "",
          address: metadata.address || "",
          description: metadata.aboutCompany || "",
          industry: metadata.industryType || "",
          skillsOffered: metadata.serviceOffered
            ? [metadata.serviceOffered]
            : [],
          opportunitiesOffered: metadata.achievements
            ? [metadata.achievements]
            : [],
          galleryImages: [],
          galleryVideos: [],
          onboardingCompleted: true,
        });
      });

      return c.json(
        {
          status_code: CREATED,
          message: "Account created successfully. You can now sign in.",
          data: {
            userId: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: "unit",
            companyName: metadata.companyName,
          },
        },
        CREATED,
      );
    } catch (err) {
      console.error("Error in transaction:", err);

      // Rollback user creation if transaction fails
      try {
        await db.delete(userTable).where(eq(userTable.id, newUser.id));
      } catch (deleteErr) {
        console.error("Error rolling back user creation:", deleteErr);
      }

      return c.json(
        {
          status_code: INTERNAL_SERVER_ERROR,
          message: "Failed to complete account setup",
        },
        INTERNAL_SERVER_ERROR,
      );
    }
  } catch (err: any) {
    console.error("Error accepting invitation:", err);

    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// "admin" is deliberately not assignable here.
const CompleteSocialSignupSchema = z
  .object({
    role: z.enum(["candidate", "unit", "mentor"]),
    companyName: z.string().trim().min(1).max(200).optional(),
    companyWebsite: z.string().url().optional(),
  })
  // A unit without a name falls back to the user's name in getProfile, which
  // for a Google signup is the person's Google display name, not the company.
  .refine((value) => value.role !== "unit" || !!value.companyName, {
    message: "Company name is required for unit signups",
    path: ["companyName"],
  });

// POST /auth/complete-social-signup - Assign the role a social sign-up chose and
// create its profile row. Google users never verify by email, so they never reach
// emailVerification.onEmailVerification; this is the second trigger for the same
// step, which is why it calls updateUserRoleOnEmailVerification rather than
// reimplementing the role logic.
export const completeSocialSignup = async (c: any): Promise<Response> => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session?.user) {
      return c.json(
        {
          status_code: UNAUTHORIZED,
          message: "Unauthorized: No session found",
        },
        UNAUTHORIZED,
      );
    }

    const parsed = CompleteSocialSignupSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message:
            parsed.error.issues[0]?.message || "A valid role is required",
        },
        BAD_REQUEST,
      );
    }

    const { role, companyName, companyWebsite } = parsed.data;
    const userId = session.user.id;

    // Only a user with no profile row yet may pick a role. Without this, any
    // signed-in user could re-POST to switch roles and escalate privileges.
    const [existingCandidate, existingUnit, existingMentor] = await Promise.all(
      [
        db
          .select({ userId: candidates.userId })
          .from(candidates)
          .where(eq(candidates.userId, userId))
          .limit(1),
        db
          .select({ userId: units.userId })
          .from(units)
          .where(eq(units.userId, userId))
          .limit(1),
        db
          .select({ userId: mentors.userId })
          .from(mentors)
          .where(eq(mentors.userId, userId))
          .limit(1),
      ],
    );

    const alreadyOnboarded =
      existingCandidate.length > 0 ||
      existingUnit.length > 0 ||
      existingMentor.length > 0;

    // A refresh or double submit is a success, not an error.
    if (alreadyOnboarded) {
      const current = await db.query.user.findFirst({
        where: (users, { eq: equals }) => equals(users.id, userId),
      });

      return c.json(
        {
          status_code: OK,
          message: "Account setup already completed",
          data: { role: current?.role, alreadyCompleted: true },
        },
        OK,
      );
    }

    // companyName lands on units.name, so the unit is never named after the
    // person's Google account.
    await updateUserRoleOnEmailVerification(userId, role, companyWebsite, {
      role,
      companyName,
      website_url: companyWebsite,
    });

    return c.json(
      {
        status_code: OK,
        message: "Account setup completed",
        data: { role, alreadyCompleted: false },
      },
      OK,
    );
  } catch (err: any) {
    console.error("Error completing social signup:", err);

    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// GET /auth/verify-invitation?id=xxx - Verify invitation is valid and return invitation details
export const verifyInvitation = async (c: any): Promise<Response> => {
  try {
    const invitationId = c.req.param("id");

    if (!invitationId) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Invitation ID is required",
        },
        BAD_REQUEST,
      );
    }

    // Find invitation by ID
    const invitation = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (!invitation || invitation.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Invalid invitation ID",
        },
        NOT_FOUND,
      );
    }

    const inv = invitation[0];
    const metadata = (inv.metadata as InvitationMetadata) || {};

    return c.json(
      {
        status_code: OK,
        message: "Invitation verification",
        data: {
          invitationId: inv.id,
          email: inv.email,
          companyName: metadata.companyName,
          companyType: metadata.companyType,
          industryType: metadata.industryType,
        },
      },
      OK,
    );
  } catch (err: any) {
    console.error("Error verifying invitation:", err);

    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
