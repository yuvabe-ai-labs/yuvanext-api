import { createRouter } from "@/lib/create-app";

import * as handlers from "./course.handlers";
import * as routes from "./course.routes";

const router = createRouter();

router.openapi(routes.getAllCourses, handlers.getAllCourses);

export default router;
