import { createRouter } from "@/lib/create-app";

import * as handlers from "./action.handlers";
import * as routes from "./action.routes";

const router = createRouter();

// Register routes
router
  .openapi(routes.saveInternship, handlers.saveInternship)
  .openapi(routes.removeSavedInternship, handlers.removeSavedInternship)
  .openapi(routes.applyToInternship, handlers.applyToInternship)
  .openapi(routes.getSavedInternships, handlers.getSavedInternships)
  .openapi(routes.getAppliedInternships, handlers.getAppliedInternships)
  .openapi(routes.getCounts, handlers.getCounts)
  .openapi(routes.shareInternship, handlers.shareInternship)
  .openapi(routes.getApplicationStatus, handlers.getApplicationStatus)
  .openapi(routes.acceptOffer, handlers.acceptOffer);

export default router;
