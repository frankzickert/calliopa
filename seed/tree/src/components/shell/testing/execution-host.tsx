import { $, component$, useStore } from "@builder.io/qwik";

import type { ExecutionProcess, ExecutionRun } from "~/lib/execution";
import type { Layout } from "~/lib/layout";
import { ExecutionSection, type ExecutionRead } from "../execution";
import type { RunChip, ViewAnswerAll, ViewToggleRun } from "../view-bridge";

/**
 * The *Execution* section wired in real JSX over stores the host owns, as the
 * shell mounts it in the panel: the document's runs as read, the reader's
 * other processes, the tab's selection, the view's chips, and what a press
 * writes to `toggleRun`, `answerAll`, the cancel and the selection, shown for
 * a test to read. A host given no document mounts the section as a tab that
 * shows none does. Test support, imported by `execution.test.ts` and nothing
 * that ships. BO_0267_010 CA_0058_005
 */
export const ExecutionHost = component$<{
  runs: ExecutionRun[];
  chips: RunChip[];
  processes?: ExecutionProcess[];
  itemId?: string | null;
}>(({ runs, chips, processes, itemId }) => {
  const document = itemId === undefined ? "doc-1" : itemId;
  const read = useStore<ExecutionRead>({ itemId: document, runs, error: null });
  const selected = useStore<{ processId: string | null }>({ processId: null });
  const selection = useStore<{ blockId: string | null }>({ blockId: null });
  const answerAll = useStore<ViewAnswerAll>({ itemId: null, group: null, answer: null, seq: 0 });
  const toggleRun = useStore<ViewToggleRun>({ itemId: null, key: null, seq: 0 });
  const cancelled = useStore<{ ids: string[] }>({ ids: [] });
  const layout = useStore<Layout>({ sections: {} } as unknown as Layout);
  return (
    <div>
      <ExecutionSection
        itemId={document}
        selection={selection.blockId}
        read={read}
        processes={processes ?? []}
        selected={selected.processId}
        chips={chips}
        answerAll={answerAll}
        toggleRun={toggleRun}
        layout={layout}
        onToggle$={$(() => undefined)}
        onCancel$={(runId: string) => {
          cancelled.ids = [...cancelled.ids, runId];
        }}
        onSelect$={(processId: string) => {
          selected.processId = selected.processId === processId ? null : processId;
        }}
        startDrag$={$(() => {})}
      />
      <button type="button" data-select-b onClick$={() => (selection.blockId = "blk-b")}>
        select b
      </button>
      <button type="button" data-select-none onClick$={() => (selection.blockId = null)}>
        select none
      </button>
      <output data-written>
        {JSON.stringify({
          toggle: { itemId: toggleRun.itemId, key: toggleRun.key, seq: toggleRun.seq },
          answer: { itemId: answerAll.itemId, group: answerAll.group, answer: answerAll.answer, seq: answerAll.seq },
          cancelled: cancelled.ids,
          selected: selected.processId,
        })}
      </output>
    </div>
  );
});
