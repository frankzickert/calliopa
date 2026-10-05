import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import { manifest } from "@qwik-client-manifest";

import render from "./entry.ssr";
import { keepServingOnUnhandledRejection } from "./server/background";
import { readGraphEnv } from "./server/ccgw/env";

readGraphEnv();
// A rejection nothing handled is logged, and the shell keeps serving. CA_0080_003
keepServingOnUnhandledRejection();

const distDir = join(fileURLToPath(import.meta.url), "..", "..", "dist");
const port = Number(process.env.PORT ?? 4300);

const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
  static: {
    root: distDir,
    cacheControl: "public, max-age=31536000, immutable",
  },
});

const server = createServer((request, response) => {
  void staticFile(request, response, () => {
    void router(request, response, () => {
      void notFound(request, response, () => undefined);
    });
  });
});

server.listen(port, "0.0.0.0");
