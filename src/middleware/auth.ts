// src/middleware/auth.ts
import { createMiddleware } from "hono/factory";

import { auth } from "@/config/auth";

export interface AuthVariables {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export function requireRole({ allowedRoles }: { allowedRoles: string[] }) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    // First, authenticate
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

    // Then, check role
    if (!role || !allowedRoles.includes(role)) {
      return c.json(
        {
          status_code: 403,
          message: `Forbidden: Requires one of the following roles: ${allowedRoles.join(", ")}`,
        },
        403,
      );
    }

    c.set("user", { id, email, role });

    await next();
  });
}
