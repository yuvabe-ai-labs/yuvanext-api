// src/middleware/auth.ts
import { createMiddleware } from "hono/factory";

import { auth } from "@/config/auth";

// Define your context variables type
export interface AuthVariables {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session?.user) {
        return c.json(
          { status_code: 401, message: "Unauthorized: No session found" },
          401,
        );
      }

      const { id, email, role } = session.user;

      // Validate that required fields exist
      if (!id || !email || !role) {
        return c.json(
          { status_code: 401, message: "Unauthorized: Invalid session data" },
          401,
        );
      }

      // Now TypeScript knows these are strings, not null/undefined
      c.set("user", {
        id,
        email,
        role,
      });

      await next();
    } catch (err) {
      console.error("[requireAuth] error:", err);
      return c.json(
        { status_code: 401, message: "Unauthorized: Authentication failed" },
        401,
      );
    }
  },
);
