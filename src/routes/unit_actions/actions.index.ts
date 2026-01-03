import { createRouter } from "@/lib/create-app";

import * as handlers from "./actions.handlers";
import * as routes from "./actions.routes";

const router = createRouter();

// Then register routes
router
  .openapi(routes.getApplications, handlers.getUnitApplications)
  .openapi(routes.updateApplicationStatus, handlers.updateApplicationStatus)
  .openapi(routes.getApplicationById, handlers.getUnitApplicationById);

export default router;
