import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "@/types/app.types";
export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/openapi", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Yuvanext API",
    },
  });

  app.get(
    "/docs",
    Scalar({
      url: "/openapi",
      theme: "bluePlanet",
      layout: "classic",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    }),
  );
}
