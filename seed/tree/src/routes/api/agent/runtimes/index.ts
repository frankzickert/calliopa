import type { RequestHandler } from "@builder.io/qwik-city";
import { api } from "~/server/api";
import { agentStatus, chosenAgent, selectableRuntimes } from "~/server/agent/adapters";
import { claudeRunnerHealth, rememberedSpeed } from "~/server/agent/bridge";
import { readCapabilities } from "~/server/capabilities";
import { port } from "~/server/port";

/**
 * What the command area offers, and which agent it opens on. `chosen` is the
 * instance's last choice (`agent-choice.json`), so every device opens on the
 * same agent; `active` is the agent's own stamp of what the gateway is
 * running, which is where the composer opens when nothing is chosen or the
 * choice cannot run. BO_0225_004 BO_0228_009
 */
export const onGet: RequestHandler = (event) =>
  api(event, async () => {
    // A device's agents are the providers it reaches with the person's keys,
    // each as its capability stands (BO_0319_043); it runs no agent
    // container to ask.
    if (port.where === "device") {
      const runtimes = (await readCapabilities())
        .filter((capability) => capability.id.startsWith("agent:"))
        .map((capability) => ({
          id: capability.id.slice("agent:".length),
          label: capability.label,
          selectable: capability.state === "ready",
          reason: capability.reason,
        }));
      event.json(200, { runtimes, chosen: null, active: null, selected: null, reason: null, speed: await rememberedSpeed() });
      return;
    }
    const [runtimes, stamped, chosen, speed] = await Promise.all([
      claudeRunnerHealth().then(selectableRuntimes),
      agentStatus(),
      chosenAgent(),
      rememberedSpeed(),
    ]);
    event.json(200, {
      // The agents. A model is no longer offered beside them: a picture is
      // made by the agent's tool under an instruction (`calliopa-bootstrap`'s
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
