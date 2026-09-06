import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { handleEpisodeRead } from "~/server/production/api";

export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleEpisodeRead(
      event.params["id"] as string,
      db(),
    );
    event.json(status, body);
  });
