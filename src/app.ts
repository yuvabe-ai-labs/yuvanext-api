import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";

import auth from "./routes/auth/auth.index";
import internship_action from "./routes/candidate_actions/action.index";
import chatbot from "./routes/chatbot/chatbot.index";
import course from "./routes/course/course.index";
import internship from "./routes/internship/internship.index";
import notification from "./routes/notification/notification.index";
import profile from "./routes/profile/profile.index";
import task from "./routes/task_management/task.index";
import unit_action from "./routes/unit_actions/actions.index";
import unit from "./routes/unit/unit.index";
import settings from "./routes/settings/settings.index";
import ai_content from "./routes/ai_content_generates/ai.content.index";
import admin from "./routes/admin_actions/admin.index";
import mentor from "./routes/mentors/mentors.index";
import mentorship_request from "./routes/mentorship_request/mentorship-request.index";
import mentor_view from "./routes/mentor_view/view.index";
import mentor_meetings from "./routes/mentor-meetings/meeting.index";

const app = createApp();

// Register routes BEFORE configuring
const apiRouters = [
  auth,
  chatbot,
  profile,
  internship,
  unit,
  course,
  internship_action,
  unit_action,
  notification,
  task,
  settings,
  ai_content,
  admin,
  mentor,
  mentorship_request,
  mentor_view,
  mentor_meetings,
] as const;

const _routes = apiRouters.map((r) => app.route("/api", r));

// Configure OpenAPI AFTER routes are registered
configureOpenAPI(app);

app.get("/", (c) => {
  return c.redirect("/docs");
});

export type AppType = (typeof _routes)[number];

export default app;
