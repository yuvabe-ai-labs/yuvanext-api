import type { NotFoundHandler } from "hono";

import type { BaseApiResponse } from "@/types/app.types.js";

import { NOT_FOUND } from "@/lib/openapi/http-status-codes.js";

const notFound: NotFoundHandler = (c) => {
  return c.json<BaseApiResponse>(
    {
      status_code: NOT_FOUND,
      message: "The requested resource was not found.",
      error: "Not Found",
    },
    NOT_FOUND,
  );
};

export default notFound;
