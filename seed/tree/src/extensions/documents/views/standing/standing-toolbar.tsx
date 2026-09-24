import { $, component$, useContext, type QRL } from "@builder.io/qwik";

import {
  CONTROL_GLYPH,
  LABEL,
  SCALE,
  type Standing,
} from "../../lib/disposition";
import type { BlockView } from "../../server/assemble";
import { StandingContext, standingOf } from "./use-standing";

/**
 * A standing where the row is: three buttons on its top border — Discard,
 * Keep, Fixate — the current one pressed, and pressing the pressed one
 * returning the row to keep. BO_0231_002 BO_0272_010 DO_0014_002
 *
 * It stands on the bar's subject while reading — the block being edited when
 * there is one, else the row turned to — and on nothing in command mode,
 * where pointing is what a press means (`DO_0014`, user decision 2026-09-23).
 * The caller draws it only there, so no rule has to hide it and a button that
 * should not be there takes no focus; the depth's categories at the other end
 * of the same border are drawn the same way. On a pointer that cannot hover,
 * the first tap makes the row the subject and the swipe is the other path. A
 * sibling of the block's marking control, never inside it, so no control is
 * nested in another. Every press writes through `setStanding$`, so the undo
 * and the announcement follow. Its own component, reading `StandingContext`,
 * so a standing written re-renders this alone.
 *
 * A proposed rewrite, insert or move carries the same three buttons, where
 * pressing one accepts the proposal and gives the block it becomes that
 * standing (`StandingButtons` with the proposal's own write): the path that
 * is not the gesture, since a proposal reaches neither the bar's control nor
 * the chord. A revealed discarded row carries them too, as the subject it is.
 * User decision, 2026-09-21 (BO_0272_010), 2026-09-23 (DO_0014_003/_004).
 */
export const StandingToolbar = component$<{ block: BlockView }>(({ block }) => {
  const { store, setStanding$ } = useContext(StandingContext);
  if (block.kind !== "text") return null;
  const standing = standingOf(block, store);
  const blockId = block.blockId;
  return (
    <StandingButtons
      current={standing}
      set$={$((to: Standing) => setStanding$(blockId, to))}
    />
  );
});

/** The three buttons themselves, over whatever write the caller hands them. */
export const StandingButtons = component$<{
  current: Standing;
  set$: QRL<(to: Standing) => void>;
}>(({ current, set$ }) => {
  return (
    <div
      class="standing-toolbar"
      role="toolbar"
      aria-label="Standing"
      data-standing-toolbar
    >
      {SCALE.map((option) => (
        <button
          key={option}
          type="button"
          data-standing-option={option}
          aria-label={LABEL[option]}
          aria-pressed={option === current ? "true" : "false"}
          title={LABEL[option]}
          onClick$={() => set$(option === current ? "keep" : option)}
        >
          <span aria-hidden="true">{CONTROL_GLYPH[option]}</span>
        </button>
      ))}
    </div>
  );
});
