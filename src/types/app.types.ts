import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Schema } from "hono";
import type { PinoLogger } from "hono-pino";

export interface BaseApiResponse<T = unknown> {
  status_code: number;
  message: string;
  error?: unknown;
  data?: T;
}

export interface AppBindings {
  Variables: {
    logger: PinoLogger;
    // Authenticated user injected by `requireAuth` middleware
    // shape matches `AuthVariables.user` in `src/middleware/auth.ts`
    user: {
      id: string;
      email: string;
      role: string;
      name?: string;
    };
  };
}

// eslint-disable-next-line ts/no-empty-object-type
export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>;
