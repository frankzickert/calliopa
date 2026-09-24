import { $, component$, useStore } from "@builder.io/qwik";

import {
  chooseAgent,
  loadAgents,
  refreshAgents,
  type AgentList,
} from "~/lib/agent-menu";
import { AgentMenu } from "../agent-menu";

/**
 * The agent dropdown wired in real JSX the way the composer wires it: the
 * agents arrive after it is drawn, from the runtimes route's answer, and it
 * opens where `openingAgent` says. Test support, imported by
 * `agent-menu.test.ts` and nothing that ships. BO_0228_014
 *
 * Real JSX and late data are the point: a prop that froze at mount passed
 * every `jsx()`-built test in BO_0227 and showed an empty list in the served
 * shell (`qwik-member-props-freeze`).
 *
 * The list is read as the shell reads it — `loadAgents` on mount,
 * `refreshAgents` when the menu opens and when a view says the agents
 * changed, which `data-agents-changed` stands for. CA_0052
 */
export const AgentMenuHost = component$(() => {
  const run = useStore<AgentList>({
    runtimes: [],
    agent: null,
    options: {},
    speed: "fast",
    notice: null,
    awaiting: null,
    openingNotice: null,
  });
  const refresh$ = $(() => refreshAgents(run));
  return (
    <div>
      <AgentMenu
        runtimes={run.runtimes}
        value={run.agent}
        disabled={false}
        onChoose$={(agent) => chooseAgent(run, agent)}
        refresh$={refresh$}
      />
      <button type="button" data-load onClick$={() => loadAgents(run)}>
        load
      </button>
      <button type="button" data-agents-changed onClick$={refresh$}>
        agents changed
      </button>
      <p data-host-agent={run.agent ?? ""} data-host-notice={run.notice ?? ""}>
        {run.notice}
      </p>
    </div>
  );
});
