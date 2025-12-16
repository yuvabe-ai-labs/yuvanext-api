import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./unit.handlers";
import * as routes from "./unit.routes";

const router = createRouter();

// Apply authentication middleware
router.use(requireAuth);

// Register routes
router
  .openapi(routes.getAllUnits, handlers.getAllUnits)
  .openapi(routes.getUnitById, handlers.getUnitById);

export default router;
