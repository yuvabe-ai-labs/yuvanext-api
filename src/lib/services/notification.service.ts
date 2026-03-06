import db from "@/db";
import { notifications } from "@/db/schema/notification.schema";

/**
 * Sends a notification to a user.
 *
 * @param userId - The ID of the user to notify.
 * @param title - The title of the notification.
 * @param message - The message content of the notification.
 * @param type - The type of notification (default: "info").
 */
export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  type: "success" | "info" | "warning" | "error" = "info",
): Promise<void> {
  await db.insert(notifications).values({
    userId,
    title,
    message,
    type,
  });
}
