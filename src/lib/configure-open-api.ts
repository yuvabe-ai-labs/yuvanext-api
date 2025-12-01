import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "@/types/app.types";

import packageJSON from "../../package.json" with { type: "json" };

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/openapi", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
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
