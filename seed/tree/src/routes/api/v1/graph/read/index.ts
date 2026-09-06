import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { handleGraphRead } from "~/server/graph/api";

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleGraphRead(event.request, db());
    event.json(status, body);
  });
