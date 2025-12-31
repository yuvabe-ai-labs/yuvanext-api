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

const ALLOWED_ORIGIN_REGEX =
  /^(https?:\/\/localhost(:\d+)?|https?:\/\/([a-z0-9-]+\.)*yuvanext\.com)$/i;

export default function createApp() {
  const app = createRouter();

  app
    .use(requestId())
    .use(pinoLogger())
    .use(
      "/*",
      cors({
        origin: (origin) => {
          if (!origin) return origin; // allow same-origin / server-to-server

          return ALLOWED_ORIGIN_REGEX.test(origin) ? origin : "";
        },
        credentials: true,
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
      }),
    );

  app.notFound(notFound);

  return app;
}
