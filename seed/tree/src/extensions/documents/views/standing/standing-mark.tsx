import { component$, useContext } from "@builder.io/qwik";

import { Icon, type IconName } from "~/components/shell/icons";
import { GLYPH, MARK, type CardMark } from "../../lib/disposition";
import type { BlockView } from "../../server/assemble";
import { StandingContext, standingOf } from "./use-standing";

/** The icon a mark with no text glyph is recognised by: the toggle that
 * reveals it, so the label and the bar's control wear one face. */
const ICON: Readonly<Partial<Record<CardMark, IconName>>> = {
  prompt: "terminal-window",
  retired: "archive",
};

/**
 * The label a marked row carries on its top border, horizontally centred: the
 * mark's glyph and its word, in one element straddling the border of the card
 * the row is drawn as. Nothing marks a block to its left any more — the
 * leading gutter is the grip's, command mode's reference number's and the
 * depth's. Decoration to a screen reader, since the row's own name says the
 * mark (`row-name.ts`). DO_0008_001
 *
 * It is a place no proposal draws anything: a proposal's chip is on the
 * bottom border and a suggestion's heading inside its card, so the label
 * says at a glance that this is the reader's own mark rather than something
 * proposed to them.
 */
export const CardLabel = component$<{ mark: CardMark }>(({ mark }) => {
  const icon = ICON[mark];
  return (
    <span class="block-card-label" data-card-label={mark} aria-hidden="true">
      {icon === undefined ? (
        <span class="block-card-label__glyph">{GLYPH[mark]}</span>
      ) : (
        <Icon name={icon} size={12} />
      )}
      <span class="block-card-label__word">{MARK[mark]}</span>
    </span>
  );
});

/**
 * A block's standing as its card's label. Its own component, so a standing
 * written while its block is being edited re-renders this alone.
 *
 * A block kept as content after it was sent carries the prompt's label while
 * *Show prompts* is on (`prompted`), unless it carries a mark of its own,
 * which is the one the label shows. BO_0267_015
 */
export const StandingMark = component$<{ block: BlockView; prompted?: boolean }>(({ block, prompted }) => {
  const { store } = useContext(StandingContext);
  const standing = standingOf(block, store);
  if (standing === "prompt" || (prompted === true && GLYPH[standing] === undefined)) {
    return <CardLabel mark="prompt" />;
  }
  if (standing === "keep") return null;
  return <CardLabel mark={standing} />;
});
