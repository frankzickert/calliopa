import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readBridgeRun } from "~/server/agent/bridge";
import { runForProcess } from "~/server/agent/conductor";
import { isRecordId } from "~/server/uuid";

/**
 * The files the run behind this process carried, from the run's own record,
 * each with what the run was given of it. A process that is not a run answers
 * an empty list, as its proposals do. BO_0229_011
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const runId = isRecordId(id) ? await runForProcess(id) : null;
    if (runId === null) {
      event.json(200, []);
      return;
    }
    const run = await readBridgeRun(runId);
    event.json(200, run.ok ? (run.value.attachments ?? []) : []);
  });
