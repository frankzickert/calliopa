import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readBridgeRun } from "~/server/agent/bridge";
import { runForProcess } from "~/server/agent/conductor";
import { isRecordId } from "~/server/uuid";

/**
 * The profile the run behind this process was guided by, from the run's own
 * record: its id and title, or null for a run with none and for a process
 * that is not a run. BO_0298_031
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const runId = isRecordId(id) ? await runForProcess(id) : null;
    if (runId === null) {
      event.json(200, null);
      return;
    }
    const run = await readBridgeRun(runId);
    event.json(200, run.ok ? (run.value.profile ?? null) : null);
  });
