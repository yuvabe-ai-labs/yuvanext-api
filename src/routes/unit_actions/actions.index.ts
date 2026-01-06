// Update your actions.index.ts file to include the new route

import { createRouter } from "@/lib/create-app";

import * as handlers from "./actions.handlers";
import * as routes from "./actions.routes";

const router = createRouter();

// Register routes
router
  .openapi(routes.getApplications, handlers.getUnitApplications)
  .openapi(routes.updateApplicationStatus, handlers.updateApplicationStatus)
  .openapi(routes.getApplicationById, handlers.getUnitApplicationById)
  .openapi(
    routes.getApplicationsByInternshipId,
    handlers.getApplicationsByInternshipId,
  );

export default router;
