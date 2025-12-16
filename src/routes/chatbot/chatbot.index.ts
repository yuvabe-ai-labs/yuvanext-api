import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";

import * as handlers from "./chatbot.handlers";
import * as routes from "./chatbot.routes";

const router = createRouter();

// Apply authentication middleware
router.use(requireAuth);

// Register routes
router.openapi(routes.chat, handlers.chat);

export default router;
