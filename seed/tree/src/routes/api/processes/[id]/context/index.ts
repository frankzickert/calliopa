import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readBridgeRun } from "~/server/agent/bridge";
import { runForProcess } from "~/server/agent/conductor";
import { isRecordId } from "~/server/uuid";

/**
 * What the run behind this process was told at its start by each extension's
 * run-start tool, from the run's own record: per extension the items it sent
 * or why it sent nothing (`calliopa-bootstrap`'s `ui-kernel.md`,
 * `BO_0310_003`), or none for a run told nothing and for a process that is
 * not a run. BO_0310_040
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
    event.json(200, run.ok ? (run.value.context ?? []) : []);
  });
