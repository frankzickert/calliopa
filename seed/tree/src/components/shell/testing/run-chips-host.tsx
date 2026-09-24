import { $, component$, useStore } from "@builder.io/qwik";

import { RunChips } from "../run-chips";
import type { RunChip, ViewAnswerAll, ViewToggleRun } from "../view-bridge";

/** The chips a document's view reports while its run goes and after: the
 * running one first, then an ended one, shown. BO_0265_008 CA_0055_002 */
export const HOST_CHIPS: readonly RunChip[] = [
  { key: "arun-live", group: null, face: { kind: "image", src: "/agents/clauderic.webp" }, tone: "claude", name: "Claude Code", text: "Reading the document", ended: false, shown: true },
  { key: "node:run-old", group: "node:run-old", face: { kind: "icon", icon: "robot" }, tone: "person", name: "an agent", text: "3 rewrites, 1 insert", count: 4, ended: true, shown: true },
];

/**
 * The run chips wired in real JSX the way the shell wires them: in a region
 * standing for `.workspace`, right after where the bar is drawn, over stores
 * the host owns. Beside them it shows what a press wrote into `answerAll` and
 * `toggleRun`, and the height the line published on the region. Test support,
 * imported by `run-chips.test.ts` and nothing that ships. CA_0055_004
 */
export const RunChipsHost = component$<{ chips: readonly RunChip[] }>(({ chips }) => {
  const answerAll = useStore<ViewAnswerAll>({ itemId: null, group: null, answer: null, seq: 0 });
  const toggleRun = useStore<ViewToggleRun>({ itemId: null, key: null, seq: 0 });
  // The chips the line draws are the host's own, so a test can change what
  // the view reports — a run ending expands its chip — without rendering over
  // the container again, which Qwik's harness refuses. CA_0062_004
  const reported = useStore<{ chips: RunChip[] }>({ chips: chips.map((chip) => ({ ...chip })) });
  const show$ = $((key: string) => {
    reported.chips = reported.chips.map((chip) => (chip.key === key ? { ...chip, shown: true } : chip));
  });
  return (
    <div>
      <section class="workspace" data-host-region>
        <div class="view-bar" data-host-bar />
        {reported.chips.length > 0 && (
          <RunChips itemId="doc-1" chips={reported.chips} answerAll={answerAll} toggleRun={toggleRun} />
        )}
      </section>
      {chips.map((chip) => (
        <button key={chip.key} type="button" data-harness-show={chip.key} onClick$={() => show$(chip.key)}>
          show {chip.key}
        </button>
      ))}
      <output data-answer-all>
        {JSON.stringify({ itemId: answerAll.itemId, group: answerAll.group, answer: answerAll.answer, seq: answerAll.seq })}
      </output>
      <output data-toggle-run>{JSON.stringify({ itemId: toggleRun.itemId, key: toggleRun.key, seq: toggleRun.seq, ...(toggleRun.work === undefined ? {} : { work: toggleRun.work }) })}</output>
    </div>
  );
});
