import { component$, useContext } from "@builder.io/qwik";

import { passagesIn, passageState } from "~/lib/references";
import { runsText } from "~/lib/runs";
import type { BlockView } from "~/server/documents/assemble";
import { MarkingContext } from "../marking/use-marking";
import { PassagesContext } from "./use-passages";

/**
 * A block's passage numbers in command mode: each resolved passage's number
 * beside its words, out of the row's flow, and each stale passage's number in
 * the gutter, saying so. BO_0227_009
 *
 * Decoration to a screen reader: the row's own name says which passages it
 * holds and which are stale (`rowName`). Its own component, so a number
 * moving re-renders this and never the block's text.
 */
export const PassageNumbers = component$<{ block: BlockView }>(({ block }) => {
  const { store: marking } = useContext(MarkingContext);
  const { badges } = useContext(PassagesContext);
  if (marking.marking.mode !== "command" || block.kind !== "text") return null;
  const passages = passagesIn(marking.marking, block.blockId);
  if (passages.length === 0) return null;
  const text = runsText(block.runs);
  const stale = passages.filter((passage) => passageState(passage, text).stale);
  return (
    <>
      {(badges[block.blockId] ?? []).map((badge) => (
        <span
          key={badge.number}
          class="passage-number"
          data-passage-number={badge.number}
          aria-hidden="true"
          style={{ top: `${badge.top}px`, left: `${badge.left}px` }}
        >
          #{badge.number}
        </span>
      ))}
      {stale.length > 0 && (
        <span class="passage-stale" aria-hidden="true">
          {stale.map((passage) => (
            <span
              key={passage.number}
              data-passage-stale={passage.number}
              title={`No longer in this block: “${passage.anchor.quote}”`}
            >
              #{passage.number} stale
            </span>
          ))}
        </span>
      )}
    </>
  );
});
