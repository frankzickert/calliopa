import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { handleStandingAssets } from "~/server/production/api";

/** The assets no episode holds, which the library lists as standing. */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleStandingAssets(db());
    event.json(status, body);
  });
