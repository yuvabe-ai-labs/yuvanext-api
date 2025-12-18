import { createRouter } from "@/lib/create-app";

import * as handlers from "./unit.handlers";
import * as routes from "./unit.routes";

const router = createRouter();

// Register routes
router
  .openapi(routes.getAllUnits, handlers.getAllUnits)
  .openapi(routes.getUnitById, handlers.getUnitById);

export default router;
