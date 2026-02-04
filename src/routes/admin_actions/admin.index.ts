import { createRouter } from "@/lib/create-app";

import * as handlers from "./admin.handlers";
import * as routes from "./admin.routes";

const router = createRouter();

// Register all admin routes
router
  // Statistics endpoints
  .openapi(routes.getOverallStats, handlers.getOverallStats)
  .openapi(routes.getUnitStats, handlers.getUnitStats)

  // Candidate endpoints
  .openapi(routes.getCandidates, handlers.getCandidates)
  .openapi(routes.getCandidateById, handlers.getCandidateById)

  // Unit endpoints
  .openapi(routes.getUnits, handlers.getUnits)
  .openapi(routes.addCompany, handlers.addCompany)
  .openapi(routes.deactivateUnit, handlers.deactivateUnit)
  .openapi(routes.activateUnit, handlers.activateUnit)

  // get the all candidates and unit data for admin
  .openapi(routes.getAllCandidatesAndUnits, handlers.getAllCandidatesAndUnits)

  // Application endpoints
  .openapi(routes.getApplications, handlers.getApplications)

  // disable the created internship by admin
  .openapi(routes.disableInternship, handlers.disableInternship)
  .openapi(routes.enableInternship, handlers.enableInternship)

  // get all internships with pagination
  .openapi(routes.getAllInternships, handlers.getAllInternships);

export default router;
