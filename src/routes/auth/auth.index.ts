import { auth as betterAuth } from "@/config/auth";
import { createRouter } from "@/lib/create-app";

const auth = createRouter().on(
  ["GET", "POST"],
  "/auth/*",
  (c) => {
    return betterAuth.handler(c.req.raw);
  },

);

export default auth;
