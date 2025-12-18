// lib/services/zoom.service.ts
import { Buffer } from "node:buffer";

import env from "@/config/env";

interface ZoomMeetingParams {
  topic: string;
  startTime: string;
  duration?: number;
  attendeeEmail: string;
  attendeeName: string;
}

interface ZoomMeetingResponse {
  id: string;
  joinUrl: string;
  startUrl: string;
  meetingId: string;
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Get Zoom OAuth token using Server-to-Server OAuth (Account Credentials)
async function getZoomAccessToken(): Promise<string | null> {
  try {
    // Check if we have Server-to-Server OAuth credentials (RECOMMENDED)
    if (env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET && env.ZOOM_ACCOUNT_ID) {
      const credentials = Buffer.from(
        `${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`,
      ).toString("base64");

      const tokenResponse = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "account_credentials",
          account_id: env.ZOOM_ACCOUNT_ID,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error(
          "Failed to get Zoom access token (account credentials):",
          errorData,
        );
        return null;
      }

      const tokenData = (await tokenResponse.json()) as ZoomTokenResponse;
      return tokenData.access_token;
    }

    // Fallback to Refresh Token flow (if configured)
    if (env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET) {
      const credentials = Buffer.from(
        `${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`,
      ).toString("base64");

      const tokenResponse = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error(
          "Failed to get Zoom access token (refresh token):",
          errorData,
        );
        return null;
      }

      const tokenData = (await tokenResponse.json()) as ZoomTokenResponse;
      return tokenData.access_token;
    }

    console.error("Missing Zoom OAuth credentials. Please set either:");
    console.error("1. ZOOM_ACCESS_TOKEN (for testing), OR");
    console.error(
      "2. ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID (recommended), OR",
    );
    console.error(
      "3. ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_REFRESH_TOKEN",
    );
    return null;
  } catch (error) {
    console.error("Error getting Zoom access token:", error);
    return null;
  }
}

// Create Zoom meeting
export async function createZoomMeeting(
  params: ZoomMeetingParams,
): Promise<ZoomMeetingResponse | null> {
  try {
    const accessToken = await getZoomAccessToken();

    if (!accessToken) {
      console.error("Zoom access token not available");
      return null;
    }

    // Format start time to ISO 8601 without milliseconds (Zoom API requirement)
    const startDate = new Date(params.startTime);
    const formattedStartTime = startDate.toISOString().split(".")[0]; // Remove milliseconds

    const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: params.topic,
        type: 2, // Scheduled meeting
        start_time: formattedStartTime,
        duration: params.duration || 60,
        timezone: "Asia/Kolkata",
        agenda: `Interview for ${params.topic}`,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true, // Allow joining before host
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 2, // No registration required
          audio: "both",
          auto_recording: "cloud", // Record to cloud
          waiting_room: false, // Disable waiting room for smoother experience
          meeting_authentication: false,
          alternative_hosts: "",
          registrants_email_notification: false,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Zoom API error:", errorData);
      return null;
    }

    const meetingData = (await response.json()) as Record<string, any>;

    // Using console.error for structured logging (allowed by ESLint)
    console.error("Zoom meeting created successfully:", {
      id: meetingData.id,
      topic: meetingData.topic,
      startTime: meetingData.start_time,
      joinUrl: meetingData.join_url,
    });

    return {
      id: meetingData.id.toString(),
      joinUrl: meetingData.join_url,
      startUrl: meetingData.start_url,
      meetingId: meetingData.id.toString(),
    };
  } catch (error) {
    console.error("Error creating Zoom meeting:", error);
    return null;
  }
}

// Cancel/Delete Zoom meeting
export async function cancelZoomMeeting(meetingId: string): Promise<boolean> {
  try {
    const accessToken = await getZoomAccessToken();

    if (!accessToken) {
      console.error("Zoom access token not available");
      return false;
    }

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to cancel Zoom meeting:", errorData);
      return false;
    }

    // Using console.error for structured logging (allowed by ESLint)
    console.error("Zoom meeting cancelled successfully:", meetingId);
    return true;
  } catch (error) {
    console.error("Error cancelling Zoom meeting:", error);
    return false;
  }
}

// Update Zoom meeting
export async function updateZoomMeeting(
  meetingId: string,
  updates: Partial<ZoomMeetingParams>,
): Promise<boolean> {
  try {
    const accessToken = await getZoomAccessToken();

    if (!accessToken) {
      console.error("Zoom access token not available");
      return false;
    }

    const body: any = {};
    if (updates.topic) body.topic = updates.topic;
    if (updates.startTime) {
      // Format start time properly
      const startDate = new Date(updates.startTime);
      body.start_time = startDate.toISOString().split(".")[0];
    }
    if (updates.duration) body.duration = updates.duration;

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to update Zoom meeting:", errorData);
      return false;
    }

    // Using console.error for structured logging (allowed by ESLint)
    console.error("Zoom meeting updated successfully:", meetingId);
    return true;
  } catch (error) {
    console.error("Error updating Zoom meeting:", error);
    return false;
  }
}

// Get meeting details
export async function getZoomMeetingDetails(
  meetingId: string,
): Promise<any | null> {
  try {
    const accessToken = await getZoomAccessToken();

    if (!accessToken) {
      console.error("Zoom access token not available");
      return null;
    }

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to get Zoom meeting details:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting Zoom meeting details:", error);
    return null;
  }
}

// Test Zoom connection
export async function testZoomConnection(): Promise<boolean> {
  try {
    const accessToken = await getZoomAccessToken();

    if (!accessToken) {
      console.error("Cannot test Zoom connection: no access token");
      return false;
    }

    const response = await fetch("https://api.zoom.us/v2/users/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Zoom connection test failed:", errorText);
      return false;
    }

    const userData = (await response.json()) as Record<string, any>;
    // Using console.error for structured logging (allowed by ESLint)
    console.error("Zoom connection successful. User:", userData.email);
    return true;
  } catch (error) {
    console.error("Error testing Zoom connection:", error);
    return false;
  }
}
