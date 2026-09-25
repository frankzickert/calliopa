import type { PointedReference, Pointing } from "~/lib/command-target";
import type { Standing } from "./disposition";
import { passageState, type Marking, type Reference } from "./references";

/**
 * What a view reports of the reader's pointing in one document: every
 * reference in mark order with the words it stands for and, for a passage,
 * whether its words still stand; and the fixated blocks in reading order.
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

/** A proposal item still open against the document, as a report reads it:
 * its words now. BO_0263_006 */
export interface OpenItem {
  readonly words: string;
}

/**
 * The report: each reference with what will be sent — what was marked and
 * the revision the reader saw — and what is shown: its words, whether a
 * passage still matches, what it is and what has happened to it since, and
 * whether a row is left to carry its number. BO_0263_006
 *
 * `items` is null until the proposals are read; a proposal is then taken as
 * still open, since an item not yet read is not one that was answered.
 */
export function pointingOf(
  marking: Marking,
  blocks: readonly PointableBlock[],
  items: ReadonlyMap<string, OpenItem> | null = null,
): Pointing {
  const held = new Map(blocks.map((block) => [block.blockId, block]));
  const references = marking.references.map((reference): PointedReference => {
    // A document marked whole: its title is what the chip says, and the
    // run is told its identity (`BO_0304_Q3`). BO_0304_009
    if (reference.kind === "document") {
      return {
        kind: "document",
        number: reference.number,
        document: reference.document,
        words: reference.documentTitle ?? reference.document,
        stale: false,
        ...(reference.documentTitle === undefined ? {} : { documentTitle: reference.documentTitle }),
      };
    }
    const sentFields = {
      ...(reference.target === undefined ? {} : { target: reference.target }),
      ...(reference.group === undefined ? {} : { group: reference.group }),
      ...(reference.item === undefined ? {} : { item: reference.item }),
      ...(reference.revisionId === undefined ? {} : { revisionId: reference.revisionId }),
      ...(reference.document === undefined ? {} : { document: reference.document }),
    };
    // A reference into another document is told as it was marked: this
    // view's blocks say nothing about it, so it is never stale or rowless
    // here, and its words are the ones kept at marking. BO_0304_009
    if (reference.document !== undefined) {
      const where = reference.documentTitle === undefined ? {} : { documentTitle: reference.documentTitle };
      return reference.kind === "passage"
        ? { kind: "passage", number: reference.number, blockId: reference.blockId, quote: reference.anchor.quote, words: reference.anchor.quote, stale: false, ...sentFields, ...where }
        : { kind: "block", number: reference.number, blockId: reference.blockId, words: openingWords(reference.words ?? ""), stale: false, ...sentFields, ...where };
    }
    const shown = standingOf(reference, held, items);
    const shownFields = {
      ...(shown.what === undefined ? {} : { what: shown.what }),
      ...(reference.proposer === undefined || shown.what !== "proposal" ? {} : { proposer: reference.proposer }),
      ...(shown.since === undefined ? {} : { since: shown.since }),
      ...(shown.rowless ? { rowless: true } : {}),
    };
    if (reference.kind === "passage") {
      return {
        kind: "passage",
        number: reference.number,
        blockId: reference.blockId,
        quote: reference.anchor.quote,
        words: reference.anchor.quote,
        // Stale only against words that still stand where it was marked: a
        // block of the document, or a proposal still open. What has gone is
        // told as it was marked, never stale.
        stale: shown.text === null ? false : passageState(reference, shown.text).stale,
        ...sentFields,
        ...shownFields,
      };
    }
    return {
      kind: "block",
      number: reference.number,
      blockId: reference.blockId,
      words: openingWords(shown.text ?? reference.words ?? ""),
      stale: false,
      ...sentFields,
      ...shownFields,
    };
  });
  const fixated = blocks
    .filter((block) => block.standing === "fixate")
    .map((block) => ({
      blockId: block.blockId,
      words: openingWords(block.text),
    }));
  return { references, fixated };
}

/** What a reference is now: what to call it, what happened since, whether a
 * row is left to carry its number, and the words that stand where it was
 * marked — null once they have gone. */
function standingOf(
  reference: Exclude<Reference, { kind: "document" }>,
  held: ReadonlyMap<string, PointableBlock>,
  items: ReadonlyMap<string, OpenItem> | null,
): {
  readonly what?: "proposal" | "retired" | "discarded";
  readonly since?: string;
  readonly rowless: boolean;
  readonly text: string | null;
} {
  const block = held.get(reference.blockId);
  switch (reference.target) {
    case "proposal": {
      const item = items?.get(reference.item ?? "");
      if (items === null) return { what: "proposal", rowless: false, text: null };
      return item === undefined
        ? { what: "proposal", since: "rejected", rowless: true, text: null }
        : { what: "proposal", rowless: false, text: item.words };
    }
    case "retired":
      return block === undefined
        ? { what: "retired", rowless: false, text: null }
        : { what: "retired", since: "restored", rowless: true, text: null };
    default: {
      if (block === undefined) return { since: "retired", rowless: true, text: null };
      const now = block.standing === "discarded";
      const was = reference.discarded === true;
      if (was || now) {
        return {
          what: "discarded",
          ...(was && !now ? { since: "reopened" } : {}),
          ...(!was && now ? { since: "discarded" } : {}),
          rowless: false,
          text: block.text,
        };
      }
      return { rowless: false, text: block.text };
    }
  }
}
