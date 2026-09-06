import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { handleMcp } from "~/server/mcp/server";

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await handleMcp(event.request, db());
    if (body === null) {
      event.send(status, "");
      return;
    }
    event.json(status, body);
  });
