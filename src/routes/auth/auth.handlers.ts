import { eq } from "drizzle-orm";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth.schema";
import { invitations } from "@/db/schema/invitation.schema";
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

// Type definitions for the request/response
interface AcceptInvitationRequest {
  token: string;
  password: string;
}

// POST /auth/accept-invitation - Accept invitation and create account with password
export const acceptInvitation = async (c: any): Promise<Response> => {
  try {
    const body = (await c.req.json()) as AcceptInvitationRequest;
    const { token, password } = body;

    if (!token || !password) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Token and password are required",
        },
        BAD_REQUEST,
      );
    }

    // Verify invitation token exists and is valid
    const invitation = await db
      .select()
      .from(invitations)
      .where(eq(invitations.invitationToken, token))
      .limit(1);

    if (!invitation || invitation.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Invalid invitation token",
        },
        NOT_FOUND,
      );
    }

    const inv = invitation[0];

    // Check if invitation is expired
    if (new Date() > inv.expiresAt) {
      return c.json(
        {
          status_code: UNAUTHORIZED,
          message: "Invitation has expired",
        },
        UNAUTHORIZED,
      );
    }

    // Check if invitation is already accepted
    if (inv.status !== "pending") {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Invitation has already been used",
        },
        BAD_REQUEST,
      );
    }

    let newUser: any;
    try {
      // Create user account using Better Auth
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: inv.email,
          password: password,
          name: inv.companyName || inv.email.split("@")[0],
          metadata: {
            role: "unit",
            invitedByAdmin: true,
          },
        },
      });

      newUser = signUpResult.user;

      // Set email as verified and assign unit role
      await db
        .update(userTable)
        .set({
          emailVerified: true, // Bypass email verification for admin invites
          role: "unit", // Assign unit role
        })
        .where(eq(userTable.id, newUser.id));
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

    // Create the unit profile
    try {
      await db.insert(units).values({
        userId: newUser.id,
        name: inv.companyName || "",
        type: inv.companyType || "",
        phone: inv.contactNumber || "",
        address: inv.address || "",
        description: inv.aboutCompany || "",
        industry: inv.industryType || "",
        skillsOffered: inv.serviceOffered ? [inv.serviceOffered] : [],
        opportunitiesOffered: inv.achievements ? [inv.achievements] : [],
        galleryImages: [],
        galleryVideos: [],
        onboardingCompleted: true, // Mark as completed since admin provided data
      });
    } catch (err) {
      console.error("Error creating unit profile:", err);
      // Rollback user creation if unit creation fails
      try {
        await db.delete(userTable).where(eq(userTable.id, newUser.id));
      } catch (deleteErr) {
        console.error("Error rolling back user creation:", deleteErr);
      }

      return c.json(
        {
          status_code: INTERNAL_SERVER_ERROR,
          message: "Failed to create unit profile",
        },
        INTERNAL_SERVER_ERROR,
      );
    }

    // Update invitation status to accepted
    await db
      .update(invitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        id: newUser.id,
      })
      .where(eq(invitations.id, inv.id));

    return c.json(
      {
        status_code: CREATED,
        message: "Account created successfully. You can now sign in.",
        data: {
          userId: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: "unit",
          companyName: inv.companyName,
        },
      },
      CREATED,
    );
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

// GET /auth/verify-invitation?token=xxx - Verify invitation is valid
export const verifyInvitation = async (c: any): Promise<Response> => {
  try {
    const token = c.req.query("token");

    if (!token) {
      return c.json(
        {
          status_code: BAD_REQUEST,
          message: "Token is required",
        },
        BAD_REQUEST,
      );
    }

    // Find invitation
    const invitation = await db
      .select()
      .from(invitations)
      .where(eq(invitations.invitationToken, token))
      .limit(1);

    if (!invitation || invitation.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Invalid invitation token",
        },
        NOT_FOUND,
      );
    }

    const inv = invitation[0];

    // Check if expired
    const isExpired = new Date() > inv.expiresAt;

    // Check if already used
    const isUsed = inv.status !== "pending";

    // Check if it's a unit invitation
    const isValidRole = inv.role === "unit";

    return c.json(
      {
        status_code: OK,
        message: "Invitation verification",
        data: {
          isValid: !isExpired && !isUsed && isValidRole,
          isExpired,
          isUsed,
          isValidRole,
          email: inv.email,
          role: inv.role,
          ...(inv.companyName && { companyName: inv.companyName }),
          expiresAt: inv.expiresAt,
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
