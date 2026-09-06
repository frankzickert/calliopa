import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { conductRun, driveRun } from "~/server/agent/conductor";

/**
 * Starts an agent run for a goal.
 *
 * The run is followed after the response is sent: handing a goal to the agent
 * is quick, but the run itself takes as long as it takes, and the shell learns
 * how it is going by polling the registry rather than by holding a request
 * open. A refusal is answered with the reason so the surface that asked can say
 * it in words.
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const body = (await event.request.json()) as { goal?: unknown };
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    if (goal === "") {
      event.json(400, { error: "A run needs a goal." });
      return;
    }

    const started = await conductRun({
      workspaceId: event.params.id ?? "",
      goal,
    });
    if (!started.ok) {
      event.json(started.reason === "busy" ? 409 : 502, {
        error: started.detail,
      });
      return;
    }

    // The goal reaches the agent after the response is sent. An unreachable
    // agent takes a network timeout to say so, and the reader should have their
    // run long before that.
    void driveRun(started.run.id, goal);
    event.json(201, {
      runId: started.run.id,
      processId: started.run.processId,
    });
  });
