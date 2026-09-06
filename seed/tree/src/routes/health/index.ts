import type { RequestHandler } from "@builder.io/qwik-city";

import { db } from "~/server/db";
import { healthResponse, probe } from "~/server/health";
import { reachBucket } from "~/server/object-store";

export const onGet: RequestHandler = async ({ cacheControl, json }) => {
  cacheControl({ noCache: true, public: false });

  const [postgres, garage] = await Promise.all([
    probe(() => db()`select 1`),
    probe(() => reachBucket()),
  ]);

  const response = healthResponse(postgres, garage);
  json(response.statusCode, response.report);
};
