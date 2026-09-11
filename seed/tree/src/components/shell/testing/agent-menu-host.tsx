import { component$, useStore } from "@builder.io/qwik";

import {
  CHOICE_NOT_REMEMBERED,
  openingAgent,
  rememberAgent,
} from "~/lib/agent-menu";
import type { SelectableRuntime } from "~/lib/connections";
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
 */
export const AgentMenuHost = component$<{
  runtimes: readonly SelectableRuntime[];
  chosen: string | null;
  active: string | null;
}>((props) => {
  const run = useStore({
    runtimes: [] as SelectableRuntime[],
    agent: null as string | null,
    notice: null as string | null,
  });
  return (
    <div>
      <AgentMenu
        runtimes={run.runtimes}
        value={run.agent}
        disabled={false}
        onChoose$={async (agent) => {
          run.agent = agent;
          if (!(await rememberAgent(agent))) run.notice = CHOICE_NOT_REMEMBERED;
        }}
      />
      <button
        type="button"
        data-load
        onClick$={() => {
          run.runtimes = [...props.runtimes];
          const opening = openingAgent(
            props.runtimes,
            props.chosen,
            props.active,
          );
          run.agent = opening.agent;
          if (opening.notice !== null) run.notice = opening.notice;
        }}
      >
        load
      </button>
      <p data-host-agent={run.agent ?? ""} data-host-notice={run.notice ?? ""}>
        {run.notice}
      </p>
    </div>
  );
});
