import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { runEvents } from "~/server/agent/conductor";
import { isRecordId } from "~/server/uuid";

/** What the console polls. The events are the normalized contract's, never the
 * agent's own JSON. */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    event.json(200, isRecordId(id) ? await runEvents(id) : []);
  });
