import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { executionRun } from "~/lib/execution";
import { listDocumentRuns } from "~/server/agent/bridge";

/**
 * The runs of one document the person may see, newest first, archived ones
 * included, for the inspector's *Execution* section. The kernel decides whose
 * runs are listed (`BO_0232`); the session is forwarded with the read.
 * BO_0267_010
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const artifact = event.url.searchParams.get("artifact")?.trim() ?? "";
    if (artifact === "") {
      event.json(400, { error: "Name the document whose runs to list." });
      return;
    }
    const listed = await listDocumentRuns(artifact);
    if (!listed.ok) {
      event.json(listed.status, { error: listed.detail });
      return;
    }
    event.json(200, { runs: listed.value.map(executionRun) });
  });
