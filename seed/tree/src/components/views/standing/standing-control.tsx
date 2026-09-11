import { component$, useContext } from "@builder.io/qwik";

import { LABEL, SCALE, type Standing } from "~/lib/disposition";
import type { BlockView } from "~/server/documents/assemble";
import { StandingContext, standingOf } from "./use-standing";

/**
 * The active block's standing, in the bar at the top of the editor area,
 * where every control acting on the active block lives (`block-editor.md`,
 * *Presentation*). The path to the scale that needs no gesture and no chord.
 * BO_0227_012
 *
 * It reads the document and the editor's block from the stores it is handed,
 * so a standing written re-renders this and not the bar. Every attribute is
 * set unconditionally: a conditional spread makes the optimizer emit a key
 * twice (`BO_0225`).
 */
export const StandingControl = component$<{
  surface: {
    readonly document: { readonly blocks: readonly BlockView[] } | null;
  };
  editor: { readonly blockId: string | null };
}>(({ surface, editor }) => {
  const { store, setStanding$ } = useContext(StandingContext);
  const blockId = editor.blockId;
  const block = surface.document?.blocks.find(
    (candidate) => candidate.blockId === blockId,
  );
  if (blockId === null || block === undefined || block.kind !== "text")
    return null;
  const standing = standingOf(block, store);
  return (
    <label class="block-toolbar__standing">
      <span>Standing</span>
      <select
        data-block-standing
        aria-label="Standing"
        onChange$={(_, element) =>
          setStanding$(blockId, element.value as Standing)
        }
      >
        {SCALE.map((option) => (
          <option key={option} value={option} selected={option === standing}>
            {LABEL[option]}
          </option>
        ))}
      </select>
    </label>
  );
});
