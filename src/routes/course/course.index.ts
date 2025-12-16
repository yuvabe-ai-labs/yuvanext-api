import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./course.handlers";
import * as routes from "./course.routes";

const router = createRouter();

// Apply authentication middleware
router.use(requireAuth);

// Register routes
router.openapi(routes.getAllCourses, handlers.getAllCourses);

export default router;
