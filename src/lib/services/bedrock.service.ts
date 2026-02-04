import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import env from "@/config/env";

const AWS_REGION = env.AWS_REGION;
const DEFAULT_MODEL = env.BEDROCK_MODEL_ID;

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const maybeCredentials =
  !isLambda && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const client = new BedrockRuntimeClient({
  region: AWS_REGION,
  ...(maybeCredentials ? { credentials: maybeCredentials } : {}),
});

export { client as bedrockClient, DEFAULT_MODEL, AWS_REGION };
