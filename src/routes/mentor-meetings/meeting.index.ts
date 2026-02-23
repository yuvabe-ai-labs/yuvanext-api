import { createRouter } from "@/lib/create-app";

import * as handlers from "./meeting.handlers";
import * as routes from "./meeting.routes";

const router = createRouter();

router
  .openapi(routes.createMeeting, handlers.createMeeting)
  .openapi(routes.cancelMeeting, handlers.cancelMeeting)
  .openapi(routes.getMentorMeetings, handlers.getMentorMeetings);

export default router;
