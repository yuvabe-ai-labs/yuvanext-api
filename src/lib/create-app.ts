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

  // Apply CORS globally to ALL routes
  app.use(
    "*",
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
    }),
  );

  // Apply other middleware after CORS
  app.use(requestId());
  app.use(pinoLogger());

  app.notFound(notFound);

  return app;
}
