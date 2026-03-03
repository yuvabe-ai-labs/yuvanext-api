import { createRouter } from "@/lib/create-app";

import * as handlers from "./view.handlers";
import * as routes from "./view.routes";
import { getMentorStats } from "./view.handlers";

const router = createRouter();

router
  .openapi(
    routes.getMentorAcceptedCandidates,
    handlers.getMentorAcceptedCandidates,
  )
  .openapi(
    routes.getMentorAcceptedCandidatesApplications,
    handlers.getMentorAcceptedCandidatesApplications,
  )
  .openapi(routes.getMentorUnits, handlers.getMentorUnits)
  .openapi(routes.getMentorStats, handlers.getMentorStats)
  .openapi(routes.getMentorUnitProfile, handlers.getMentorUnitProfile)
  .openapi(routes.getMentorHiredCandidates, handlers.getMentorHiredCandidates)
  .openapi(routes.getMentorUnitCandidates, handlers.getMentorUnitCandidates)
  .openapi(routes.getMentorDashboard, handlers.getMentorDashboard);

export default router;
