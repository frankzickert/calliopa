import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { cancelRun } from "~/server/agent/conductor";

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const run = id === "" ? null : await cancelRun(id);
    if (run === null) {
      event.json(404, { error: `No run ${id} is known to the kernel.` });
      return;
    }
    event.json(200, { runId: run.runId, state: "cancelled" });
  });
