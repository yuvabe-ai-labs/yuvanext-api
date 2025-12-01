import { serve } from "@hono/node-server";

import app from "./app";
import env from "./config/env";

serve({
  fetch: app.fetch,
  port: env.PORT,
}, (info) => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on port http://localhost:${info.port}`);
});
