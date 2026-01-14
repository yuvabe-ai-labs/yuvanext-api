import { createRouter } from "@/lib/create-app";

import * as handlers from "./internship.handlers";
import * as routes from "./internship.routes";

const router = createRouter();

// Register routes
router
  .openapi(routes.getUnitStats, handlers.getUnitStats)
  .openapi(routes.getInternships, handlers.getInternships)
  .openapi(routes.getRecommendedInternships, handlers.getRecommendedInternships)
  .openapi(routes.createInternship, handlers.createInternship)
  .openapi(routes.getInternshipById, handlers.getInternshipById)
  .openapi(routes.updateInternship, handlers.updateInternship)
  .openapi(routes.deleteInternship, handlers.deleteInternship);

export default router;
