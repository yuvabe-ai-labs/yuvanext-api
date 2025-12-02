import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";

import auth from "./routes/auth/auth.index";

const app = createApp();

configureOpenAPI(app);

const routes = [auth] as const;

routes.forEach((route) => {
  app.basePath("/api").route("", route);
});

app.get("/", (c) => {
  return c.redirect("/docs");
});

export type AppType = (typeof routes)[number];

export default app;
