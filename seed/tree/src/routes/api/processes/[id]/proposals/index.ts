import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { runForProcess } from "~/server/agent/runs";
import { runProposals } from "~/server/agent/proposed";
import { isRecordId } from "~/server/uuid";

/**
 * What the run behind this process proposed.
 *
 * A process that is not a run answers an empty list rather than a refusal: the
 * inspector asks the same question of whatever is selected, and "this is a
 * render, not a run" is not an error worth a status code.
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const id = event.params.id ?? "";
    const run = isRecordId(id) ? await runForProcess(id) : null;
    event.json(200, run === null ? [] : await runProposals(run.id));
  });
