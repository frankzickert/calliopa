import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readReplay } from "~/server/agent/replay";

/** What a replay plays of a finished run, or why it cannot be replayed, in
 * words. BO_0340_001 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    if (id === "") {
      event.json(404, { error: "No run is named." });
      return;
    }
    const replay = await readReplay(id);
    if (!replay.ok) {
      event.json(replay.status, { error: replay.detail });
      return;
    }
    event.json(200, replay.value);
  });
