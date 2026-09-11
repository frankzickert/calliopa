import { $, component$, useStore } from "@builder.io/qwik";

import {
  commandTarget,
  NO_CHOICE,
  type Pointing,
} from "~/lib/command-target";
import { activeTab, type Tab, type TabsState } from "~/lib/tabs";
import { Composer, type ComposerAim, type ComposerRun } from "../composer";
import type { ViewAction, ViewDock, ViewReveal } from "../view-bridge";

/**
 * The composer wired in real JSX the way the shell wires it, over stores the
 * host owns: the dock's contributed action, the tabs, the aim with its marks,
 * the run and `reveal`. The report is the plain `NO_POINTING` until the first
 * one arrives and the store's object after. Test support, imported by the
 * composer's `*.test.ts` files and nothing that ships. BO_0227_017 CA_0039_001
 *
 * Real JSX is the point. The optimizer compiles a prop written as
 * `object.field` through `_wrapProp`, which stays reactive only when the
 * object is a store; a test that builds its elements with `jsx()` never meets
 * that, which is how two lists froze in the served shell while every such
 * test passed.
 *
 * Beside the composer it shows what `sendGoal$` would post
 * (`commandTarget`, the very function the shell's press calls) and what the
 * last chip wrote into `reveal`, for a test to read.
 */
const documentTab = (id: string, title: string): Tab => ({
  id: `tab-${id}`,
  kind: "ui.shell:document",
  title,
  itemId: id,
  viewType: "block-editor",
  selection: null,
  drawerContext: null,
  unsaved: false,
});

const settingsTab: Tab = {
  id: "tab-settings",
  kind: "settings:settings",
  title: "Settings",
  itemId: "instance",
  viewType: "settings",
  selection: null,
  drawerContext: null,
  unsaved: false,
};

export const ComposerHost = component$<{ report: Pointing }>(({ report }) => {
  const commandMode: ViewAction = {
    kind: "toggle",
    id: "command-mode",
    label: "Command mode",
    on: false,
    run$: $(() => undefined),
  };
  const dock = useStore<ViewDock>({ action: commandMode });
  const tabs = useStore<TabsState>({
    tabs: [
      documentTab("doc-1", "Draft of the storm chapter"),
      documentTab("doc-2", "Notes"),
      settingsTab,
    ],
    activeTabId: "tab-doc-1",
  });
  const aim = useStore<ComposerAim>({ pointing: {}, choice: NO_CHOICE });
  const run = useStore<ComposerRun>({
    runtimes: [],
    agent: null,
    sending: false,
    notice: null,
  });
  const reveal = useStore<ViewReveal>({ itemId: null, target: null, seq: 0 });
  const target = commandTarget(activeTab(tabs), aim.choice, aim.pointing);
  return (
    <div>
      <Composer
        dock={dock}
        tabs={tabs}
        aim={aim}
        run={run}
        reveal={reveal}
        onRun$={$(() => undefined)}
        onChooseAgent$={$(() => undefined)}
      />
      <button
        type="button"
        data-report
        onClick$={() => {
          aim.pointing = { "doc-1": report };
        }}
      >
        report
      </button>
      <button
        type="button"
        data-sending
        onClick$={() => {
          run.sending = !run.sending;
        }}
      >
        sending
      </button>
      {tabs.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-switch={tab.id}
          onClick$={() => {
            tabs.activeTabId = tab.id;
            // The shell's tab switch clears the old view's action, and a
            // document's editor contributes its toggle again.
            dock.action = tab.kind === "ui.shell:document" ? commandMode : null;
          }}
        >
          {tab.title}
        </button>
      ))}
      <output data-target>{JSON.stringify(target)}</output>
      <output data-reveal>
        {JSON.stringify({ itemId: reveal.itemId, target: reveal.target, seq: reveal.seq })}
      </output>
    </div>
  );
});
