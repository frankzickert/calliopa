import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { sendLoginCode } from "~/extensions/settings/server/adapters";

/**
 * Hands the broker the code a flow asked for. It is written where the broker
 * reads it and is never answered back: it is a one-time code, and a surface
 * that could read it again would be a place it could be taken from.
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const body = (await event.request.json()) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (code === "") {
      event.json(400, { error: "A code is needed." });
      return;
    }
    await sendLoginCode(code);
    event.json(202, {});
  });
