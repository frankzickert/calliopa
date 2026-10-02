import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { agentStatus, chosenAgent, selectableRuntimes } from "~/server/agent/adapters";
import { claudeRunnerHealth, rememberedSpeed } from "~/server/agent/bridge";

/**
 * What the command area offers, and which agent it opens on. `chosen` is the
 * instance's last choice (`agent-choice.json`), so every device opens on the
 * same agent; `active` is the agent's own stamp of what the gateway is
 * running, which is where the composer opens when nothing is chosen or the
 * choice cannot run. BO_0225_004 BO_0228_009
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const [runtimes, stamped, chosen, speed] = await Promise.all([
      claudeRunnerHealth().then(selectableRuntimes),
      agentStatus(),
      chosenAgent(),
      rememberedSpeed(),
    ]);
    event.json(200, {
      // The agents. A model is no longer offered beside them: a picture is
      // made by the agent's tool under a profile (`calliopa-bootstrap`'s
      // BO_0312).
      runtimes,
      chosen,
      active: stamped?.runtime ?? null,
      selected: stamped?.selected ?? null,
      reason: stamped?.reason ?? null,
      // The signed-in person's last speed, which the composer opens on.
      // BO_0269_015
      speed,
    });
  });
