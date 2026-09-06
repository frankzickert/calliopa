import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { db } from "~/server/db";
import { releaseFront } from "~/server/publishing/front-api";

/**
 * Publishing a front. There is one act rather than two: a front is replaced by
 * the next publication and never retired.
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const { status, body } = await releaseFront(
      db(),
      event.params["channel"] as string,
    );
    event.json(status, body);
  });
