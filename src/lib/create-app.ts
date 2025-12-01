import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { AppBindings } from "@/types/app.types";

import { pinoLogger } from "@/middleware/logger";
import notFound from "@/middleware/not-found";

import defaultHook from "./openapi/default-hook";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    defaultHook,
  });
}
export default function createApp() {
  const app = createRouter();

  app.use(requestId())
    .use(pinoLogger())
    .use("*", cors({
      origin: "*", // replace with your origin
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }));

  app.notFound(notFound);

  return app;
}
