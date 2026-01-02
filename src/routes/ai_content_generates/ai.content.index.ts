import { createRouter } from "@/lib/create-app";

import * as handlers from "./ai.content.handlers";
import * as routes from "./ai.content.routes";

const router = createRouter();

// Register AI content generation route
router.openapi(routes.generateInternshipContent, handlers.generateContent);
router.openapi(routes.enhanceProfileDescription, handlers.enhanceProfile);

export default router;
