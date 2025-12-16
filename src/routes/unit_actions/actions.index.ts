import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./actions.handlers";
import * as routes from "./actions.routes";

const router = createRouter();

// Apply authentication middleware
router.use(requireAuth);

// Register routes
router
  .openapi(routes.getApplications, handlers.getUnitApplications)
  .openapi(routes.updateApplicationStatus, handlers.updateApplicationStatus);

export default router;
