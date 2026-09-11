import type { PinnedBlock, PointedReference, Pointing } from "./command-target";
import type { Standing } from "./disposition";
import { passageState, type Marking } from "./references";

/**
 * What a view reports of the reader's pointing in one document: every
 * reference in mark order with the words it stands for and, for a passage,
 * whether its words still stand; and the pinned blocks in reading order.
 * BO_0227_015
 *
 * Pure, over the marking and the document's text blocks, so the composer's
 * chips and its refusal rest on something a unit test can read.
 */

/** A text block as the report reads it, in reading order. */
export interface PointableBlock {
  readonly blockId: string;
  readonly text: string;
  readonly standing: Standing;
}

/** How much of a block the composer shows for it: enough to recognise it,
 * never the whole of a long paragraph. In code points. */
export const OPENING_CHARS = 60;

export function openingWords(text: string): string {
  const characters = [...text.trim()];
  return characters.length <= OPENING_CHARS
    ? characters.join("")
    : `${characters.slice(0, OPENING_CHARS).join("").trimEnd()}…`;
}

export function pointingOf(
  marking: Marking,
  blocks: readonly PointableBlock[],
): Pointing {
  const textOf = new Map(blocks.map((block) => [block.blockId, block.text]));
  const references = marking.references.map((reference): PointedReference => {
    const text = textOf.get(reference.blockId) ?? "";
    if (reference.kind === "passage") {
      return {
        kind: "passage",
        number: reference.number,
        blockId: reference.blockId,
        quote: reference.anchor.quote,
        words: reference.anchor.quote,
        stale: passageState(reference, text).stale,
      };
    }
    return {
      kind: "block",
      number: reference.number,
      blockId: reference.blockId,
      words: openingWords(text),
      stale: false,
    };
  });
  const pinned = blocks
    .filter((block) => block.standing === "pin")
    .map((block) => ({
      blockId: block.blockId,
      words: openingWords(block.text),
    }));
  return { references, pinned };
}

/**
 * A reference chip's accessible name: its number and the words it stands for,
 * and that it is stale when its words have gone, since the chip itself shows
 * only the number. CA_0039_003
 */
export function chipName(reference: PointedReference): string {
  return `Reference ${reference.number}${reference.stale ? ", stale" : ""}: “${reference.words}”`;
}

/** A pinned block's chip, which carries no number: a pinned block is a
 * standing, not a reference. CA_0039_003 */
export function pinnedChipName(pinned: PinnedBlock): string {
  return `Pinned: “${pinned.words}”`;
}
