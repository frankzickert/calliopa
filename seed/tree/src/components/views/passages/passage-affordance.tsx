import { $, component$, useContext } from "@builder.io/qwik";

import { anchorAt, quotable } from "~/lib/passage";
import { passagesIn, passageState } from "~/lib/references";
import { runsText } from "~/lib/runs";
import type { BlockView } from "~/server/documents/assemble";
import { MarkingContext } from "../marking/use-marking";
import { PassagesContext } from "./use-passages";

/**
 * **Reference** beside a selection in command mode, **Re-point #n** for each
 * stale passage of the block it is in, and **Take back #n** in place of
 * Reference when the words are already a passage. BO_0227_009
 *
 * Selecting words is how people read on a screen, so selecting marks nothing;
 * referencing is this explicit act. Each control acts on `pointerdown` and
 * prevents that press's default, because the press that reaches a control is
 * otherwise the one that collapses the selection it is acting on. Its own
 * component, reading the selection's own store, so the words being selected
 * are never re-rendered under the selection. `Enter` on the row does the same
 * from the keyboard (`BlockRow`).
 */
export const PassageAffordance = component$<{
  surface: {
    readonly document: { readonly blocks: readonly BlockView[] } | null;
  };
}>(({ surface }) => {
  const passages = useContext(PassagesContext);
  const {
    store: marking,
    addPassage$,
    repointPassage$,
    removeReference$,
  } = useContext(MarkingContext);
  const selected = passages.selected;
  if (selected === null || marking.marking.mode !== "command") return null;
  const block = surface.document?.blocks.find(
    (candidate) => candidate.blockId === selected.blockId,
  );
  if (block === undefined || block.kind !== "text") return null;
  const text = runsText(block.runs);
  const anchor = anchorAt(text, selected.start, selected.end);
  const inBlock = passagesIn(marking.marking, block.blockId);
  const stale = inBlock.filter((passage) => passageState(passage, text).stale);
  // Words already marked as a passage are taken back by selecting them again,
  // as a marked block is by pressing it again.
  const marked = inBlock.find(
    (passage) => passage.anchor.quote === anchor.quote,
  );
  // The words were taken; the selection they were taken from goes with the
  // affordance, from the page the pressed control is on.
  const done$ = $((control: HTMLElement) => {
    passages.selected = null;
    control.ownerDocument.getSelection?.()?.removeAllRanges();
  });
  return (
    <div
      class="passage-affordance"
      role="toolbar"
      aria-label="Selected words"
      data-passage-affordance
      style={{ top: `${selected.bottom + 6}px`, left: `${selected.left}px` }}
    >
      {marked !== undefined ? (
        <button
          type="button"
          data-passage-take-back={marked.number}
          preventdefault:pointerdown
          preventdefault:mousedown
          onPointerDown$={async (_, control) => {
            await removeReference$(marked.number);
            await done$(control);
          }}
        >
          {`Take back #${marked.number}`}
        </button>
      ) : quotable(anchor.quote) ? (
        <button
          type="button"
          data-passage-reference
          preventdefault:pointerdown
          preventdefault:mousedown
          onPointerDown$={async (_, control) => {
            await addPassage$(block.blockId, anchor);
            await done$(control);
          }}
        >
          Reference
        </button>
      ) : (
        <span class="passage-affordance__refusal">
          Too long for a passage — mark the block
        </span>
      )}
      {quotable(anchor.quote) &&
        stale.map((passage) => (
          <button
            key={passage.number}
            type="button"
            data-passage-repoint={passage.number}
            preventdefault:pointerdown
            preventdefault:mousedown
            onPointerDown$={async (_, control) => {
              await repointPassage$(passage.number, anchor);
              await done$(control);
            }}
          >
            {`Re-point #${passage.number}`}
          </button>
        ))}
    </div>
  );
});
