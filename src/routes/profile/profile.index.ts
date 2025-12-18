import { createRouter } from "@/lib/create-app";

import * as handlers from "./profile.handlers";
import * as routes from "./profile.routes";

const router = createRouter();

router
  .openapi(routes.getProfile, handlers.getProfile)
  .openapi(routes.updateProfile, handlers.updateProfile);

export default router;
