import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { runEvents } from "~/server/agent/conductor";

/** What the console polls: the bridge's buffered history, as the normalized
 * contract's events. BO_0207_015 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    event.json(200, id === "" ? [] : await runEvents(id));
  });
