import { createRouter } from "@/lib/create-app";

import * as handlers from "./settings.handlers";
import * as routes from "./settings.routes";

const router = createRouter();

router.openapi(routes.changePhone, handlers.changePhone);
router.openapi(routes.updateNotifications, handlers.updateNotifications);
router.openapi(routes.setDisability, handlers.setDisability);
router.openapi(routes.deactivateAccount, handlers.deactivateAccount);

export default router;
