import { $, component$, useContext, type QRL } from "@builder.io/qwik";

import { runsText } from "~/lib/runs";
import { openingWords } from "../../lib/pointing";
import type { Marked } from "../../lib/references";
import type { BlockView } from "../../server/assemble";
import { RowMarks, rowMarkAttributes, rowMarkingName, rowNumbers } from "../marking/row-marks";
import { MarkingContext } from "../marking/use-marking";
import { clickMarks } from "../press";
import { RowGrip } from "../row-grip";
import { CardLabel } from "./standing-mark";
import { StandingButtons } from "./standing-toolbar";
import { StandingContext } from "./use-standing";

/**
 * A discarded block, drawn where it sits because the reader asked to see what
 * they set aside. Visibly not the flow — a dotted card, dimmed, labelled
 * `discarded` on its top border (`CardLabel`, `DO_0008_003`) — and its
 * one action is to reopen, which returns it to neutral. A discarded block is
 * still in the document and its order, which is the difference from a
 * retired one: it comes back where it always was, with one press or one
 * swipe. BO_0227_014
 *
 * In command mode its words mark it, as a block's do, and take passages: a
 * discarded block is a block of the document the reader set aside, and the
 * mark says so. BO_0263_005
 */
export const DiscardedRow = component$<{
  block: BlockView;
  first: boolean;
  last: boolean;
  startDrag$: QRL<(blockId: string, preview: string, event: PointerEvent) => void>;
  stepRow$: QRL<(position: string, direction: -1 | 1) => void>;
  /** Tells the editor the reader has turned to this row. A discarded block
   * is a block of the document, so the bar's block groups act on it as they
   * act on any block — *Standing* is the second way off discarded, beside
   * *Reopen*. A retired row has none of this: it is out of the document's
   * flow. User decision, 2026-09-21. DO_0006_005 */
  focus$?: QRL<(blockId: string) => void>;
  /** Whether this is the row the reader has turned to, so it carries the
   * focused row's ring like any block. DO_0006_012 */
  focused?: boolean;
}>(({ block, first, last, startDrag$, stepRow$, focus$, focused }) => {
  const standing = useContext(StandingContext);
  const controls = useContext(MarkingContext);
  const store = controls.store;
  const text = block.kind === "text" ? runsText(block.runs) : "";
  const marked: Marked = { revisionId: block.revisionId, words: openingWords(text), discarded: true };
  const commanding = store.marking.mode === "command";
  const numbers = rowNumbers(store.marking, block.blockId, marked);
  return (
    <div
      class="discarded-row"
      data-discarded-id={block.blockId}
      data-focused={focused === true ? "true" : undefined}
      aria-label={`Discarded block: ${text}`}
      {...rowMarkAttributes(block.blockId, marked)}
      data-reference={commanding && numbers.reference !== null ? numbers.reference : undefined}
    >
      <RowMarks blockId={block.blockId} marked={marked} />
      {/* A discarded row is the bar's subject like any block, so it carries
          the standing toolbar while reading: the second way off discarded,
          where the row is, beside *Reopen*. DO_0014_004 */}
      {!commanding && focused === true && (
        <StandingButtons
          current="discarded"
          set$={$((to) => standing.setStanding$(block.blockId, to))}
        />
      )}
      {/* Moved as any block is, and still discarded. BO_0263_013 */}
      {!commanding && (
        <RowGrip
          inline
          label="discarded block"
          first={first}
          last={last}
          drag$={$((event: PointerEvent) => startDrag$(block.blockId, text, event))}
          step$={$((direction: -1 | 1) => stepRow$(block.blockId, direction))}
        />
      )}
      <CardLabel mark="discarded" />
      <div
        class="discarded-row__text"
        data-mark-text
        // A tap focuses the row, which shows its grip on a phone and makes
        // the row the subject of the bar's block groups. DO_0006_005
        tabIndex={commanding ? 0 : -1}
        onFocusIn$={() => {
          if (focus$ !== undefined) void focus$(block.blockId);
        }}
        {...(commanding
          ? {
              role: "button",
              "aria-pressed": numbers.reference !== null,
              "aria-label": rowMarkingName(`discarded block: “${openingWords(text)}”`, numbers.reference, numbers.passages),
            }
          : {})}
        onClick$={(_: MouseEvent, element: HTMLElement) => {
          if (store.marking.mode !== "command" || !clickMarks(element)) return;
          void controls.toggleReference$(block.blockId, marked);
        }}
        onKeyDown$={(event: KeyboardEvent) => {
          if (store.marking.mode !== "command" || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          void controls.toggleReference$(block.blockId, marked);
        }}
      >
        {text}
      </div>
      <button
        type="button"
        data-discarded-reopen={block.blockId}
        onClick$={() => standing.setStanding$(block.blockId, "keep")}
      >
        Reopen
      </button>
    </div>
  );
});
