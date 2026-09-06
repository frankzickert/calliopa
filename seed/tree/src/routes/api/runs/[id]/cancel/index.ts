import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { cancelRun } from "~/server/agent/conductor";
import { isRecordId } from "~/server/uuid";

export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const run = isRecordId(id) ? await cancelRun(id) : null;
    if (run === null) {
      event.json(404, { error: `No run ${id} is active.` });
      return;
    }
    event.json(200, { runId: run.id, state: "cancelled" });
  });
