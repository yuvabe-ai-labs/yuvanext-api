// lambda.ts
import { handle } from "hono/aws-lambda";

import app from "./app";

// Hono's built-in AWS Lambda handler
export const handler = handle(app);
