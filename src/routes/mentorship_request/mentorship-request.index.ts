import { createRouter } from "@/lib/create-app";

import * as handlers from "./mentorship-request.handlers";
import * as routes from "./mentorship-request.routes";

const router = createRouter();

// Candidate routes
router
  .openapi(routes.createMentorshipRequest, handlers.createMentorshipRequest)
  .openapi(routes.cancelMentorshipRequest, handlers.cancelMentorshipRequest)
  .openapi(routes.getCandidateOwnRequests, handlers.getCandidateOwnRequests);

// Mentor routes
router
  .openapi(routes.getMentorIncomingRequests, handlers.getMentorIncomingRequests)
  .openapi(
    routes.respondToMentorshipRequest,
    handlers.respondToMentorshipRequest,
  );

export default router;
