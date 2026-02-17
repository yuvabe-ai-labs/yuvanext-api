import { createRouter } from "@/lib/create-app";

import * as handlers from "./mentors.handlers";
import * as routes from "./mentors.routes";

const router = createRouter();

// Register routes
router
  .openapi(routes.getMentors, handlers.getAllMentors)
  .openapi(routes.getMentorById, handlers.getMentorById);

export default router;
