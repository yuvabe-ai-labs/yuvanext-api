import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./task.handlers";
import * as routes from "./task.routers";

const router = createRouter();

// Apply authentication middleware
router.use(requireAuth);

// Register routes
router
  .openapi(routes.createTask, handlers.createTask)
  .openapi(routes.getAllTasks, handlers.getAllTasks)
  .openapi(routes.updateTask, handlers.updateTask)
  .openapi(routes.deleteTask, handlers.deleteTask)
  .openapi(routes.reviewTask, handlers.reviewTask);

export default router;
