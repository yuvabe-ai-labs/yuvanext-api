// // src/middleware/role-check.ts
// import { createMiddleware } from "hono/factory";
// import type { AuthVariables } from "./auth";
// import { FORBIDDEN } from "@/lib/openapi/http-status-codes";

// /**
//  * Middleware to check if the authenticated user has one of the allowed roles
//  * Must be used AFTER requireAuth middleware
//  *
//  * @param allowedRoles - Array of roles that are permitted to access the route
//  * @returns Middleware that checks user role
//  *
//  * @example
//  * // Single role
//  * router.use(requireAuth, requireRole(["candidate"]));
//  *
//  * @example
//  * // Multiple roles
//  * router.use(requireAuth, requireRole(["candidate", "unit"]));
//  */
// export const requireRole = (allowedRoles: string[]) => {
//   return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
//     const user = c.get("user");

//     if (!user || !user.role) {
//       return c.json(
//         {
//           status_code: FORBIDDEN,
//           message: "Access denied: No role found",
//         },
//         FORBIDDEN
//       );
//     }

//     if (!allowedRoles.includes(user.role)) {
//       const roleList = allowedRoles.length === 1
//         ? allowedRoles[0]
//         : allowedRoles.slice(0, -1).join(", ") + " or " + allowedRoles[allowedRoles.length - 1];

//       return c.json(
//         {
//           status_code: FORBIDDEN,
//           message: `Access denied: Only ${roleList} can access this resource`,
//         },
//         FORBIDDEN
//       );
//     }

//     await next();
//   });
// };
