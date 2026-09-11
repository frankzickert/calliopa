import { component$, useContext } from "@builder.io/qwik";

import { DISPOSITIONS, GLYPH, LABEL } from "~/lib/disposition";
import type { BlockView } from "~/server/documents/assemble";
import { StandingContext, standingOf } from "./use-standing";

/**
 * A block's standing in command mode, where the block is: four buttons on its
 * top border — Keep, Pin, Resolve, Discard — the current one pressed, and
 * pressing it again returns the block to neutral. BO_0231_002
 *
 * In command mode no block is active, so the bar's control is never there;
 * this is the pointer's way to the scale in the mode where standing matters
 * most. Shown while the pointer is over the block and while focus is within
 * it (`block-editor.css`), so hover is never the only way to it; on a pointer
 * that cannot hover the swipe is the path. A sibling of the block's marking
 * control, never inside it, so no control is nested in another. Every press
 * writes through `setStanding$`, so the undo and the announcement follow. Its
 * own component, reading `StandingContext`, so a standing written re-renders
 * this alone.
 */
export const StandingToolbar = component$<{ block: BlockView }>(({ block }) => {
  const { store, setStanding$ } = useContext(StandingContext);
  if (block.kind !== "text") return null;
  const standing = standingOf(block, store);
  return (
    <div
      class="standing-toolbar"
      role="toolbar"
      aria-label="Standing"
      data-standing-toolbar
    >
      {DISPOSITIONS.map((option) => (
        <button
          key={option}
          type="button"
          data-standing-option={option}
          aria-label={LABEL[option]}
          aria-pressed={option === standing ? "true" : "false"}
          title={LABEL[option]}
          onClick$={() =>
            setStanding$(
              block.blockId,
              option === standing ? "neutral" : option,
            )
          }
        >
          <span aria-hidden="true">{GLYPH[option]}</span>
        </button>
      ))}
    </div>
  );
});
