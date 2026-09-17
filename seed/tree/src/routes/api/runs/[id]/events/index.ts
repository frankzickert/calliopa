import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { runEvents } from "~/server/agent/conductor";

/** What the console polls: the bridge's buffered history, as the normalized
 * contract's events. BO_0207_015 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const events = id === "" ? [] : await runEvents(id);
    if (events === null) {
      event.json(404, { error: `No run ${id} is known to the kernel.` });
      return;
    }
    event.json(200, events);
  });
