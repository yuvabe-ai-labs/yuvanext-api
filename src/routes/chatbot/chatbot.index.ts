import { createRouter } from "@/lib/create-app";

import * as handlers from "./chatbot.handlers";
import * as routes from "./chatbot.routes";

const router = createRouter();

// Register route - handler is now type-compatible
router.openapi(routes.chat, handlers.chat);

export default router;
