import { $, component$, type QRL } from "@builder.io/qwik";

import {
  deliveryFor,
  documentOf,
  NO_POINTING,
  type Delivery,
  type DeliveryChoice,
  type Pointing,
  type RevealTarget,
} from "~/lib/command-target";
import type { SelectableRuntime } from "~/lib/connections";
import { activeTab, type TabsState } from "~/lib/tabs";
import { AgentMenu } from "./agent-menu";
import { CommandField } from "./command-field";
import { CommandStrip } from "./command-strip";
import { Icon } from "./icons";
import { ReferenceChips } from "./reference-chips";
import type { ViewDock, ViewReveal } from "./view-bridge";

/**
 * The command bar: the strip naming where the work goes, then one bar — the
 * agent dropdown at the left, the field with the command's chips along its
 * bottom edge, and Run inside the field at its right end — and the notice
 * line under it, so a refusal is still shown beside the control that was
 * pressed (`CA_0022_018`). CA_0039_001 CA_0039_002 CA_0039_003
 *
 * Its own component over the shell's stores, so the render harness mounts the
 * wiring the shell mounts (`testing/composer-host.tsx`). What a press sends is
 * the shell's `sendGoal$`, which reads the same stores through
 * `commandTarget`. The composer is no drop target: the attachment it once
 * showed was never sent, and a file as context is `BO_0229`'s (`CA_0039_006`).
 */

/** What the reader has marked per document, and where the next command's
 * work goes. */
export interface ComposerAim {
  pointing: Record<string, Pointing>;
  choice: DeliveryChoice;
}

/** What the composer reads of the run: the agents, the chosen one, whether a
 * command is being sent, and the last refusal. */
export interface ComposerRun {
  runtimes: SelectableRuntime[];
  agent: string | null;
  sending: boolean;
  notice: string | null;
}

export const Composer = component$<{
  dock: ViewDock;
  tabs: TabsState;
  aim: ComposerAim;
  run: ComposerRun;
  reveal: ViewReveal;
  onRun$: QRL<() => void>;
  onChooseAgent$: QRL<(agent: string) => void>;
}>(({ dock, tabs, aim, run, reveal, onRun$, onChooseAgent$ }) => {
  const active = activeTab(tabs);
  const aimedAt = documentOf(active);
  const title =
    aimedAt === null ? null : (active?.title.split(" · ")[0] ?? "");
  const delivery: Delivery =
    aimedAt === null ? "propose" : deliveryFor(aimedAt, aim.choice);
  const pointing =
    aimedAt === null ? NO_POINTING : (aim.pointing[aimedAt] ?? NO_POINTING);

  // The document is read from the store at the press, never captured: a
  // closure from an earlier render names the tab that was active then.
  const setDelivery$ = $((next: Delivery) => {
    const itemId = documentOf(activeTab(tabs));
    if (itemId !== null) aim.choice = { itemId, delivery: next };
  });
  const reveal$ = $((target: RevealTarget) => {
    reveal.itemId = documentOf(activeTab(tabs));
    reveal.target = target;
    reveal.seq += 1;
  });

  return (
    <div class="composer">
      <CommandStrip
        dock={dock}
        title={title}
        delivery={delivery}
        onDelivery$={setDelivery$}
      />
      <div class="composer__bar">
        <AgentMenu
          runtimes={run.runtimes}
          value={run.agent}
          disabled={run.sending}
          onChoose$={onChooseAgent$}
        />
        <div class="composer__field">
          <label for="command" class="visually-hidden">
            Command
          </label>
          <CommandField pointing={pointing} />
          <ReferenceChips pointing={pointing} onReveal$={reveal$} />
          <button
            type="button"
            class="composer__run"
            data-run
            aria-label="Run"
            onClick$={onRun$}
            disabled={run.sending}
          >
            <Icon name="play" />
          </button>
        </div>
      </div>
      {run.notice !== null && (
        <p class="composer__notice" role="status" data-run-notice>
          {run.notice}
        </p>
      )}
    </div>
  );
});
