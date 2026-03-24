import { drizzle } from "drizzle-orm/node-postgres";

import env from "@/config/env";
import * as schema from "@/db/schema/index";

const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
  },
  casing: "snake_case",
  schema,
});

export default db;
