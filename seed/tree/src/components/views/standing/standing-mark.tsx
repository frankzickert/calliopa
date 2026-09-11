import { component$, useContext } from "@builder.io/qwik";

import { GLYPH, MARK } from "~/lib/disposition";
import type { BlockView } from "~/server/documents/assemble";
import { StandingContext, standingOf } from "./use-standing";

/**
 * A block's standing, in the leading gutter beside any reference number: its
 * glyph always, and its word where the gutter has room. Decoration to a
 * screen reader, since the row's own name says the standing. Its own
 * component, so a standing written while its block is being edited re-renders
 * this alone.
 */
export const StandingMark = component$<{ block: BlockView }>(({ block }) => {
  const { store } = useContext(StandingContext);
  const standing = standingOf(block, store);
  const glyph = GLYPH[standing];
  if (glyph === undefined) return null;
  return (
    <span
      class="block-standing"
      data-standing-mark={standing}
      aria-hidden="true"
    >
      <span class="block-standing__glyph">{glyph}</span>
      <span class="block-standing__word">{MARK[standing]}</span>
    </span>
  );
});
