import { handle } from "hono/aws-lambda";
import app from "./app";

// Export the handler for AWS Lambda
export const handler = handle(app);
