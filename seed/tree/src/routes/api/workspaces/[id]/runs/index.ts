import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { readCommandTarget } from "~/lib/command-target";
import { conductRun, followRun } from "~/server/agent/conductor";

/**
 * Starts an agent run for a goal through the kernel's agent bridge.
 *
 * The run is followed after the response is sent: the bridge takes a goal
 * quickly, the run takes as long as it takes, and the shell learns how it is
 * going by polling the registry rather than by holding a request open. A
 * refusal is answered with the kernel's reason so the surface that asked can
 * say it in words. BO_0207_015
 *
 * A command from an open document carries what it was aimed at — the
 * document, where its work goes, and what the reader marked — and a shape the
 * composer never sends is refused here by name rather than forwarded.
 * BO_0226_004
 */
export const onPost: RequestHandler = (event) =>
  api(event, async () => {
    const body = (await event.request.json()) as {
      goal?: unknown;
      agent?: unknown;
      artifact?: unknown;
      delivery?: unknown;
      references?: unknown;
    };
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    if (goal === "") {
      event.json(400, { error: "A run needs a goal." });
      return;
    }
    const target = readCommandTarget(body);
    if (!target.ok) {
      event.json(400, { error: target.error });
      return;
    }

    const started = await conductRun({
      workspaceId: event.params.id ?? "",
      goal,
      ...(typeof body.agent === "string" && body.agent !== "" ? { agent: body.agent } : {}),
      target: target.target,
    });
    if (!started.ok) {
      event.json(started.reason === "busy" ? 409 : started.reason === "refused" ? 400 : 502, {
        error: started.detail,
      });
      return;
    }

    void followRun(started.process.id, started.runId);
    event.json(201, {
      runId: started.runId,
      processId: started.process.id,
    });
  });
