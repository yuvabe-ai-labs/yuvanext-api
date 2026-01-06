import { createRouter } from "@/lib/create-app";

import * as handlers from "./task.handlers";
import * as routes from "./task.routers";

const router = createRouter();

router
  .openapi(routes.createTask, handlers.createTask)
  .openapi(routes.getAllTasks, handlers.getAllTasks)
  .openapi(routes.getTasksByApplicationId, handlers.getTasksByApplicationId)
  .openapi(routes.deleteTask, handlers.deleteTask)
  .openapi(routes.updateTask, handlers.updateTask)
  .openapi(routes.reviewTask, handlers.reviewTask);

export default router;
