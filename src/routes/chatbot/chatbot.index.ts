import { createRouter } from "@/lib/create-app";

import * as handlers from "./chatbot.handlers";
import * as routes from "./chatbot.routes";

const router = createRouter();

// Apply authentication middleware

// Register routes
router.openapi(routes.chat, handlers.chat);

export default router;
