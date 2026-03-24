import { createRouter } from "@/lib/create-app";

import * as handlers from "./view.handlers";
import * as routes from "./view.routes";

const router = createRouter();

router
  .openapi(
    routes.getMentorAcceptedCandidates,
    handlers.getMentorAcceptedCandidates,
  )

  .openapi(routes.getMentorUnits, handlers.getMentorUnits)
  .openapi(routes.getMentorStats, handlers.getMentorStats)
  .openapi(routes.getMentorUnitProfile, handlers.getMentorUnitProfile);

export default router;
