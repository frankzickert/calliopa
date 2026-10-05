import { component$, useContext } from "@builder.io/qwik";

import { passagesIn, passageState } from "../../lib/references";
import { runsText } from "~/lib/runs";
import type { BlockView } from "../../server/assemble";
import { MarkingContext } from "../marking/use-marking";
import { PassagesContext } from "./use-passages";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { actsOnBody } from "../decorations";

/** The kind a marked passage carries when dragged (`BO_0349_013`): its
 * block and number in the id, its words as the preview. */
export const PASSAGE_DRAG_KIND = "documents:passage";

/** A dragged passage's block, read back from its id. */
export const passageBlock = (itemId: string): string | null => {
  const parts = itemId.split(":");
  return parts.length === 3 && parts[0] === "passage" ? (parts[1] ?? null) : null;
};

/**
 * A block's passage numbers in command mode: each resolved passage's number
 * beside its words, out of the row's flow, and each stale passage's number in
 * the gutter, saying so. BO_0227_009
 *
 * Decoration to a screen reader: the row's own name says which passages it
 * holds and which are stale (`rowName`). Its own component, so a number
 * moving re-renders this and never the block's text.
 */
export const PassageNumbers = component$<{ block: BlockView; documentId?: string }>(({ block, documentId }) => {
  const { store: marking } = useContext(MarkingContext);
  const { badges } = useContext(PassagesContext);
  const bridge = useContext(ViewBridgeContext, null);
  if (marking.marking.mode !== "command" || block.kind !== "text") return null;
  const passages = passagesIn(marking.marking, block.blockId);
  if (passages.length === 0) return null;
  const text = runsText(block.runs);
  const stale = passages.filter((passage) => passageState(passage, text).stale);
  return (
    <>
      {(badges[block.blockId] ?? []).map((badge) => {
        const quote = passages.find((passage) => passage.number === badge.number)?.anchor.quote ?? "";
        const target = `passage:${block.blockId}:${badge.number}`;
        return (
          // A marked passage's number is where its words are taken from and
          // where a structure is dropped to apply to them alone: the badge
          // drags as the passage, linked rather than moved, and takes a library
          // item (BO_0349_013, BO_0349_038).
          <span
            key={badge.number}
            class="passage-number"
            data-passage-number={badge.number}
            data-drop-target={target}
            data-accepts="link"
            data-drop-active={bridge?.drag.overId === target && bridge.drag.operation === "link" && actsOnBody(bridge.drag.payload?.kind ?? "") ? "true" : undefined}
            aria-hidden="true"
            style={{ top: `${badge.top}px`, left: `${badge.left}px` }}
            onPointerDown$={(event: PointerEvent) => {
              if (bridge === null || event.button !== 0 || quote === "") return;
              void bridge.startDrag$(
                { itemId: `passage:${block.blockId}:${badge.number}`, kind: PASSAGE_DRAG_KIND, source: "workspace", operations: ["link"], preview: quote, from: documentId },
                event,
              );
            }}
          >
            #{badge.number}
          </span>
        );
      })}
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
