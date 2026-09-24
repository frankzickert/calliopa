import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { agentStatus, chosenAgent, selectableRuntimes } from "~/server/agent/adapters";
import { claudeRunnerHealth, rememberedSpeed } from "~/server/agent/bridge";
import { senders } from "~/server/registry";

/**
 * What the command area offers, and which agent it opens on. `chosen` is the
 * instance's last choice (`agent-choice.json`), so every device opens on the
 * same agent; `active` is the agent's own stamp of what the gateway is
 * running, which is where the composer opens when nothing is chosen or the
 * choice cannot run. BO_0225_004 BO_0228_009
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    const [runtimes, stamped, chosen, speed, offered] = await Promise.all([
      claudeRunnerHealth().then(selectableRuntimes),
      agentStatus(),
      chosenAgent(),
      rememberedSpeed(),
      senders(),
    ]);
    event.json(200, {
      // The agents, then what the extensions offer beside them: a sender is
      // chosen and sent to the way an agent is, and the press on *Send* is the
      // whole gesture. BO_0273_035
      runtimes: [...runtimes, ...offered],
      chosen,
      active: stamped?.runtime ?? null,
      selected: stamped?.selected ?? null,
      reason: stamped?.reason ?? null,
      // The signed-in person's last speed, which the composer opens on.
      // BO_0269_015
      speed,
    });
  });
