import { drizzle } from "drizzle-orm/node-postgres";
import net from "node:net";
import { Pool } from "pg";

import env from "@/config/env";
import * as schema from "@/db/schema/index";

// Node gives each resolved address only 250ms to connect before trying the next.
// From high-latency networks (e.g. local dev far from us-east-1) every attempt
// times out, so most connections fail with ETIMEDOUT. Allow 2s per attempt.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

// Neon closes idle connections on its side. Without these settings the pool can
// hand out a dead connection, and the next query (e.g. Better Auth's session
// lookup) fails with FAILED_TO_GET_SESSION / 500.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  keepAlive: true,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Idle clients that error out are removed from the pool; log instead of crashing
pool.on("error", (err) => {
  console.error("Postgres pool error (idle client):", err.message);
});

const db = drizzle({
  client: pool,
  casing: "snake_case",
  schema,
});

export default db;
