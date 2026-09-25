import { $, component$, useStore, useTask$ } from "@builder.io/qwik";

import { executionProcess } from "~/lib/execution";
import type { Layout } from "~/lib/layout";
import type { ProcessRecord } from "~/lib/process";
import { NO_SELECTION, pressProcess } from "~/lib/process-selection";
import type { Tab, TabsState } from "~/lib/tabs";
import { ExecutionSection, type ExecutionRead } from "../execution";
import {
  InspectorPanel,
  type ProcessRegistry,
  type ProposedRead,
} from "../inspector";
import type { RunEvent } from "~/server/agent/run-events";
import type { ViewAnswerAll, ViewInspector, ViewToggleRun } from "../view-bridge";

/**
 * The panel's run list and the inspector, wired in real JSX the way the shell
 * wires them: the registry, the tabs and the view's contribution are stores
 * the host owns, and a tab switch is the active tab id changing, which is all
 * the shell's switch does to them. Test support, imported by
 * `process-selection.test.ts` and nothing that ships. CA_0040_001 CA_0058_005
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
  kind: "documents:document",
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
  const proposed = useStore<ProposedRead>({ processId: null, documents: [], attachments: [], profile: null, events: [] });
  const read = useStore<ExecutionRead>({ itemId: null, runs: [], error: null });
  const answerAll = useStore<ViewAnswerAll>({ itemId: null, group: null, answer: null, seq: 0 });
  const toggleRun = useStore<ViewToggleRun>({ itemId: null, key: null, seq: 0 });
  const layout = useStore<Layout>({ sections: {} } as unknown as Layout);
  /** What the shell's own task does when the selection changes: it reads the
   * selected run's events for the detail. CA_0058_006 */
  useTask$(({ track }) => {
    const selected = track(() =>
      tabs.activeTabId === null
        ? registry.selection.noTab
        : (registry.selection.byTab[tabs.activeTabId] ?? null),
    );
    proposed.processId = selected;
    // The run behind p1 was guided by a profile; p2's was not. BO_0298_031
    proposed.profile = selected === "p1" ? { id: "prof-1", title: "Blog post" } : null;
    proposed.events =
      selected === null
        ? []
        : ([
            { kind: "runStarted" },
            { kind: "toolStarted", tool: "read_document" },
            { kind: "runCompleted", output: "Proposed one rewrite." },
          ] as RunEvent[]);
  });
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
      <ExecutionSection
        itemId={null}
        selection={null}
        read={read}
        processes={registry.items.map(executionProcess)}
        selected={
          tabs.activeTabId === null
            ? registry.selection.noTab
            : (registry.selection.byTab[tabs.activeTabId] ?? null)
        }
        chips={[]}
        answerAll={answerAll}
        toggleRun={toggleRun}
        layout={layout}
        onToggle$={$(() => undefined)}
        onCancel$={$(() => undefined)}
        onSelect$={$((processId: string) => {
          registry.selection = pressProcess(registry.selection, tabs.activeTabId, processId);
        })}
        startDrag$={$(() => {})}
      />
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
