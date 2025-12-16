import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./notification.handlers";
import * as routes from "./notification.routes";

const router = createRouter();

// Apply authentication middleware
router.use(requireAuth);

// Register routes
router
  .openapi(routes.getUserNotifications, handlers.getUserNotifications)
  .openapi(routes.markNotificationAsRead, handlers.markNotificationAsRead)
  .openapi(
    routes.markAllNotificationsAsRead,
    handlers.markAllNotificationsAsRead,
  )
  .openapi(routes.deleteNotification, handlers.deleteNotification)
  .openapi(routes.deleteAllNotifications, handlers.deleteAllNotifications);

export default router;
