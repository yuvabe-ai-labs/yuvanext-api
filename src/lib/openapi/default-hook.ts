import type { Hook } from "@hono/zod-openapi";

import type { BaseApiResponse } from "@/types/app.types";

import { UNPROCESSABLE_ENTITY } from "./http-status-codes";

const defaultHook: Hook<any, any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json<BaseApiResponse>(
      {
        status_code: UNPROCESSABLE_ENTITY,
        message: "Validation Error",
        error: {
          name: result.error.name,
          issues: result.error.issues,
        },
      },
      UNPROCESSABLE_ENTITY,
    );
  }
};

export default defaultHook;
