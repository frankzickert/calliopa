import { $, component$, useStore } from "@builder.io/qwik";

import type { ProcessRecord } from "~/lib/process";
import { NO_SELECTION } from "~/lib/process-selection";
import type { Tab, TabsState } from "~/lib/tabs";
import {
  InspectorPanel,
  ProcessList,
  type ProcessRegistry,
  type ProposedRead,
} from "../inspector";
import type { ViewInspector } from "../view-bridge";

/**
 * The console's process list and the inspector, wired in real JSX the way the
 * shell wires them: the registry, the tabs and the view's contribution are
 * stores the host owns, and a tab switch is the active tab id changing, which
 * is all the shell's switch does to them. Test support, imported by
 * `process-selection.test.ts` and nothing that ships. CA_0040_001
 */
const process = (id: string, title: string): ProcessRecord => ({
  id,
  workspaceId: "w",
  title,
  state: "completed",
  step: "Done",
  error: null,
  itemId: null,
  itemKind: null,
  acknowledged: false,
  createdAt: "2026-09-10T14:00:00Z",
  updatedAt: "2026-09-10T14:00:00Z",
});

const tab = (id: string): Tab => ({
  id,
  kind: "ui.shell:document",
  title: id,
  itemId: id,
  viewType: "block-editor",
  selection: null,
  drawerContext: null,
  unsaved: false,
});

export const InspectorHost = component$(() => {
  const registry = useStore<ProcessRegistry>({
    items: [process("p1", "write a brief intro"), process("p2", "tighten #6")],
    selection: NO_SELECTION,
  });
  const tabs = useStore<TabsState>({
    tabs: [tab("a"), tab("b")],
    activeTabId: "a",
  });
  const proposed = useStore<ProposedRead>({ processId: null, documents: [] });
  const inspector = useStore<ViewInspector>({
    text: null,
    facts: [],
    actions: [
      {
        kind: "choice",
        id: "change-status",
        label: "Status",
        value: "idea",
        options: [
          { value: "idea", label: "idea" },
          { value: "draft", label: "draft" },
        ],
        run$: $(() => {}),
      },
    ],
  });
  return (
    <div>
      {tabs.tabs.map((open) => (
        <button
          key={open.id}
          type="button"
          data-switch={open.id}
          onClick$={() => {
            tabs.activeTabId = open.id;
          }}
        >
          {open.title}
        </button>
      ))}
      <ProcessList registry={registry} tabs={tabs} startDrag$={$(() => {})} />
      <aside data-inspector-panel>
        <InspectorPanel
          registry={registry}
          tabs={tabs}
          proposed={proposed}
          inspector={inspector}
          declared="Workspace context"
          viewId="block-editor"
          openTarget$={$(() => {})}
          acknowledge$={$(() => {})}
        />
      </aside>
    </div>
  );
});
