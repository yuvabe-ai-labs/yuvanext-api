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

export const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "https://app.yuvanext.com",
  "https://app-stg.yuvanext.com",
  "https://app-dev.yuvanext.com",
];

export default function createApp() {
  const app = createRouter();

  app.use(
    "*",
    cors({
      origin: ALLOWED_ORIGINS,
      allowMethods: ["POST", "GET", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Better-Auth",
      ],
      exposeHeaders: ["Content-Length", "Set-Cookie"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use(requestId()).use(pinoLogger());

  app.notFound(notFound);

  return app;
}
