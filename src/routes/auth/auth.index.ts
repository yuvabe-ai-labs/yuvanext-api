import { createRouter } from "@/lib/create-app";
import { auth as betterAuth } from "@/config/auth";
import { acceptInvitation, verifyInvitation } from "./auth.handlers";

const auth = createRouter()
  // Custom invitation endpoints
  .post("/auth/accept-invitation", acceptInvitation)
  .get("/auth/verify-invitation/:id", verifyInvitation)
  // Better Auth routes
  .on(["GET", "POST"], "/auth/*", (c) => {
    return betterAuth.handler(c.req.raw);
  });

export default auth;
