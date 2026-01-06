import { createRouter } from "@/lib/create-app";

import * as handlers from "./admin.handlers";
import * as routes from "./admin.routes";

const router = createRouter();

// Register routes
router
  .openapi(routes.getAllCandidates, handlers.getAllCandidates)
  .openapi(routes.getCandidateById, handlers.getCandidateById);

export default router;
