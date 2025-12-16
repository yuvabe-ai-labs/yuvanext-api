import { desc, eq } from "drizzle-orm";

import type { AppRouteHandler } from "@/types/app.types";

import db from "@/db";
import { notifications } from "@/db/schema/notification.schema";
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
} from "@/lib/openapi/http-status-codes";

import type {
  DeleteAllNotifications,
  DeleteNotification,
  GetUserNotifications,
  MarkAllNotificationsAsRead,
  MarkNotificationAsRead,
} from "./notification.routes";

// GET /notifications - Get all notifications for the authenticated user
export const getUserNotifications: AppRouteHandler<
  GetUserNotifications
> = async (c) => {
  const user = c.get("user");

  try {
    // Get all notifications for this user, ordered by creation date (newest first)
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt));

    // Count unread notifications
    const unreadCount = userNotifications.filter((n) => !n.isRead).length;

    return c.json(
      {
        status_code: OK,
        message: "Notifications retrieved successfully",
        data: {
          notifications: userNotifications,
          total: userNotifications.length,
          unreadCount,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// PUT /notifications/:id/mark-read - Mark a notification as read
export const markNotificationAsRead: AppRouteHandler<
  MarkNotificationAsRead
> = async (c) => {
  const user = c.get("user");
  const notificationId = c.req.param("id");

  if (!notificationId) {
    return c.json(
      {
        status_code: BAD_REQUEST,
        message: "Notification ID is required",
      },
      BAD_REQUEST,
    );
  }

  try {
    // Check if notification exists and belongs to user
    const notification = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification || notification.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Notification not found",
        },
        NOT_FOUND,
      );
    }

    // Verify the notification belongs to this user
    if (notification[0].userId !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only update your own notifications",
        },
        FORBIDDEN,
      );
    }

    // Mark as read
    const [updatedNotification] = await db
      .update(notifications)
      .set({
        isRead: true,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "Notification marked as read",
        data: updatedNotification,
      },
      OK,
    );
  } catch (err) {
    console.error("Error marking notification as read:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// PUT /notifications/mark-all-read - Mark all notifications as read for the user
export const markAllNotificationsAsRead: AppRouteHandler<
  MarkAllNotificationsAsRead
> = async (c) => {
  const user = c.get("user");

  try {
    // Mark all user's notifications as read
    const updatedNotifications = await db
      .update(notifications)
      .set({
        isRead: true,
        updatedAt: new Date(),
      })
      .where(eq(notifications.userId, user.id))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "All notifications marked as read",
        data: {
          updatedCount: updatedNotifications.length,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /notifications/:id - Delete a notification by ID
export const deleteNotification: AppRouteHandler<DeleteNotification> = async (
  c,
) => {
  const user = c.get("user");
  const notificationId = c.req.param("id");

  if (!notificationId) {
    return c.json(
      {
        status_code: BAD_REQUEST,
        message: "Notification ID is required",
      },
      BAD_REQUEST,
    );
  }

  try {
    // Check if notification exists and belongs to user
    const notification = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification || notification.length === 0) {
      return c.json(
        {
          status_code: NOT_FOUND,
          message: "Notification not found",
        },
        NOT_FOUND,
      );
    }

    // Verify the notification belongs to this user
    if (notification[0].userId !== user.id) {
      return c.json(
        {
          status_code: FORBIDDEN,
          message: "You can only delete your own notifications",
        },
        FORBIDDEN,
      );
    }

    // Delete the notification
    await db.delete(notifications).where(eq(notifications.id, notificationId));

    return c.json(
      {
        status_code: OK,
        message: "Notification deleted successfully",
      },
      OK,
    );
  } catch (err) {
    console.error("Error deleting notification:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};

// DELETE /notifications - Delete all notifications for the user
export const deleteAllNotifications: AppRouteHandler<
  DeleteAllNotifications
> = async (c) => {
  const user = c.get("user");

  try {
    // Delete all notifications for this user
    const deletedNotifications = await db
      .delete(notifications)
      .where(eq(notifications.userId, user.id))
      .returning();

    return c.json(
      {
        status_code: OK,
        message: "All notifications deleted successfully",
        data: {
          deletedCount: deletedNotifications.length,
        },
      },
      OK,
    );
  } catch (err) {
    console.error("Error deleting all notifications:", err);
    return c.json(
      {
        status_code: INTERNAL_SERVER_ERROR,
        message: "Internal server error",
      },
      INTERNAL_SERVER_ERROR,
    );
  }
};
