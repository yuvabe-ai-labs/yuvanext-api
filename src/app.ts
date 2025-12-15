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

const app = createApp();

// Register routes BEFORE configuring OpenAPI
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
] as const;

const _routes = apiRouters.map((r) => app.route("/api", r));

// Configure OpenAPI AFTER routes are registered
configureOpenAPI(app);

app.get("/", (c) => {
  return c.redirect("/docs");
});

export type AppType = (typeof _routes)[number];

export default app;
