import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { listFronts } from "~/server/publishing/front-api";

/** The destinations that show a front, which is what the library lists. */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await listFronts(db());
    event.json(status, body);
  });
