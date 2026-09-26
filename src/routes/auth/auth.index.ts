import { createRouter } from "@/lib/create-app";
import { auth as betterAuth } from "@/config/auth";
import {
  acceptInvitation,
  completeSocialSignup,
  verifyInvitation,
} from "./auth.handlers";

const auth = createRouter()
  // Custom invitation endpoints
  .post("/auth/accept-invitation", acceptInvitation)
  .get("/auth/verify-invitation/:id", verifyInvitation)
  // Social sign-up role completion. Must stay above the /auth/* catch-all.
  .post("/auth/complete-social-signup", completeSocialSignup)
  // Better Auth routes
  .on(["GET", "POST"], "/auth/*", (c) => {
    return betterAuth.handler(c.req.raw);
  });

export default auth;
