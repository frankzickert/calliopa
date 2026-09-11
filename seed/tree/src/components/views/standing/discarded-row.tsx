import { component$, useContext } from "@builder.io/qwik";

import { runsText } from "~/lib/runs";
import type { BlockView } from "~/server/documents/assemble";
import { StandingContext } from "./use-standing";

/**
 * A discarded block, drawn where it sits because the reader asked to see what
 * they set aside. Visibly not the flow — dimmed, named as discarded — and not
 * markable; the one thing it offers is to reopen, which returns it to neutral.
 * A discarded block is still in the document and its order, which is the
 * difference from a retired one: it comes back where it always was, with one
 * press or one swipe. BO_0227_014
 */
export const DiscardedRow = component$<{ block: BlockView }>(({ block }) => {
  const { setStanding$ } = useContext(StandingContext);
  const text = block.kind === "text" ? runsText(block.runs) : "";
  return (
    <div
      class="discarded-row"
      data-discarded-id={block.blockId}
      aria-label={`Discarded block: ${text}`}
    >
      <p class="discarded-row__mark" aria-hidden="true">
        Discarded
      </p>
      <div class="discarded-row__text">{text}</div>
      <button
        type="button"
        data-discarded-reopen={block.blockId}
        onClick$={() => setStanding$(block.blockId, "neutral")}
      >
        Reopen
      </button>
    </div>
  );
});
