import {
  quotable,
  resolvePassage,
  type PassageAnchor,
  type PassageRange,
} from "./passage";

/**
 * What a reader has pointed at in one document, and how it is kept.
 *
 * A reference is a block, or a passage inside one (`BO_0227_008`). A block
 * reference identifies its block by identity; a passage reference is anchored
 * by its words (`passage.ts`). The number is a human-facing alias, never the
 * thing a reference points at, so reordering or restructuring a document
 * retargets nothing. Blocks and passages share one number sequence in the
 * order the reader marked them — a block then a passage read `#1`, `#2`.
 *
 * Pure, because where a number comes from is the part worth being sure of: a
 * mark keeps the number it was given for as long as it stands, and a number is
 * retired with its mark rather than handed to the next one.
 */

/** The one mode the block editor surface is in. Reading is the resting state
 * and not a mode the reader selects; command is one they enter and leave. */
export type EditorMode = "reading" | "command";

export interface BlockReference {
  readonly kind: "block";
  readonly blockId: string;
  readonly number: number;
}

export interface PassageReference {
  readonly kind: "passage";
  readonly blockId: string;
  readonly number: number;
  readonly anchor: PassageAnchor;
}

export type Reference = BlockReference | PassageReference;

/** A document's marking session: what is marked, in mark order, and the number
 * the next mark takes. */
export interface Marking {
  readonly mode: EditorMode;
  readonly references: readonly Reference[];
  readonly next: number;
}

export const NO_MARKING: Marking = {
  mode: "reading",
  references: [],
  next: 1,
};

/** Device-local and per document: marking is presentation state, never graph
 * truth, and it does not follow the reader to another device. */
export const markingKey = (documentId: string): string =>
  `calliopa.marking.${documentId}`;

/** The number of the block reference to this block, or null. */
export const referenceFor = (
  marking: Marking,
  blockId: string,
): number | null =>
  marking.references.find(
    (held) => held.kind === "block" && held.blockId === blockId,
  )?.number ?? null;

/** The passages marked inside this block, in mark order. */
export const passagesIn = (
  marking: Marking,
  blockId: string,
): readonly PassageReference[] =>
  marking.references.filter(
    (held): held is PassageReference =>
      held.kind === "passage" && held.blockId === blockId,
  );

/** With nothing left standing there is no number to disagree with, so
 * numbering starts again at 1; otherwise the counter stands where it is. */
function keeping(marking: Marking, references: readonly Reference[]): Marking {
  return {
    ...marking,
    references,
    next: references.length === 0 ? 1 : marking.next,
  };
}

function appending(marking: Marking, reference: Reference): Marking {
  return {
    ...marking,
    references: [...marking.references, reference],
    next: marking.next + 1,
  };
}

/**
 * Marks a block, or takes the mark back.
 *
 * Marking appends, so numbers rise in the order the reader marked. Unmarking
 * leaves every standing reference the number it already carries — a number
 * never changes under a reader who did not touch it — and the number it
 * carried is not reissued while any mark stands. A block's passages are their
 * own references and stand whatever happens to the block's.
 */
export function toggleReference(marking: Marking, blockId: string): Marking {
  if (referenceFor(marking, blockId) !== null) {
    return keeping(
      marking,
      marking.references.filter(
        (held) => !(held.kind === "block" && held.blockId === blockId),
      ),
    );
  }
  return appending(marking, { kind: "block", blockId, number: marking.next });
}

/**
 * Marks words inside a block as a passage.
 *
 * Words that cannot be a passage — none, or more than the bound — change
 * nothing, and neither do words already marked as a passage of the same
 * block: pointing at them twice points at the same thing.
 */
export function addPassage(
  marking: Marking,
  blockId: string,
  anchor: PassageAnchor,
): Marking {
  if (!quotable(anchor.quote)) return marking;
  if (
    passagesIn(marking, blockId).some(
      (held) => held.anchor.quote === anchor.quote,
    )
  ) {
    return marking;
  }
  return appending(marking, {
    kind: "passage",
    blockId,
    number: marking.next,
    anchor,
  });
}

/**
 * Points a passage at new words, keeping its number and its place in mark
 * order — the command may already name it by that number, and a repair that
 * minted a new one would leave the words naming a reference that no longer
 * exists. Only a passage re-anchors, and only within its own block.
 */
export function repointPassage(
  marking: Marking,
  number: number,
  anchor: PassageAnchor,
): Marking {
  if (!quotable(anchor.quote)) return marking;
  return {
    ...marking,
    references: marking.references.map((held) =>
      held.kind === "passage" && held.number === number
        ? { ...held, anchor }
        : held,
    ),
  };
}

/** Takes one reference back by its number. */
export function removeReference(marking: Marking, number: number): Marking {
  const references = marking.references.filter(
    (held) => held.number !== number,
  );
  return references.length === marking.references.length
    ? marking
    : keeping(marking, references);
}

/**
 * Drops the references whose blocks the document no longer draws in its
 * flow — a block gone, or set aside as discarded.
 *
 * A mark on nothing cannot be drawn, and the document is the only list there
 * is, so an unavailable reference has nowhere to appear. A passage whose words
 * have gone from a block still present is not dropped: stale is a state the
 * reader sees and repairs, never a deletion.
 */
export function keepPresent(
  marking: Marking,
  blockIds: readonly string[],
): Marking {
  const present = new Set(blockIds);
  const references = marking.references.filter((held) =>
    present.has(held.blockId),
  );
  if (references.length === marking.references.length) return marking;
  return keeping(marking, references);
}

/**
 * Puts back references a change took with it — discarding a marked block
 * drops its marks, and taking the discard back restores them. Each returns
 * under the number it carried, unless that number or what it pointed at has
 * been marked again since, and the counter stands above every number standing.
 * BO_0227_013
 */
export function restoreReferences(
  marking: Marking,
  dropped: readonly Reference[],
): Marking {
  const restored = dropped.filter(
    (reference) =>
      !marking.references.some(
        (held) =>
          held.number === reference.number || samePointing(held, reference),
      ),
  );
  if (restored.length === 0) return marking;
  const references = [...marking.references, ...restored].sort(
    (left, right) => left.number - right.number,
  );
  const highest = references.reduce(
    (top, held) => Math.max(top, held.number),
    0,
  );
  return { ...marking, references, next: Math.max(marking.next, highest + 1) };
}

/** Where a passage stands in its block's current text: its range, or stale. */
export type PassageState =
  | { readonly stale: false; readonly range: PassageRange }
  | { readonly stale: true };

export function passageState(
  reference: PassageReference,
  text: string,
): PassageState {
  const range = resolvePassage(reference.anchor, text);
  return range === null ? { stale: true } : { stale: false, range };
}

function readAnchor(value: unknown): PassageAnchor | null {
  if (typeof value !== "object" || value === null) return null;
  const { quote, prefix, suffix, hint } = value as Record<string, unknown>;
  if (
    typeof quote !== "string" ||
    !quotable(quote) ||
    typeof prefix !== "string" ||
    typeof suffix !== "string" ||
    typeof hint !== "number" ||
    !Number.isInteger(hint) ||
    hint < 0
  ) {
    return null;
  }
  return { quote, prefix, suffix, hint };
}

/** Whether two references point at the same thing: one block, or the same
 * words of one block. */
function samePointing(a: Reference, b: Reference): boolean {
  if (a.blockId !== b.blockId) return false;
  if (a.kind === "block") return b.kind === "block";
  return b.kind === "passage" && a.anchor.quote === b.anchor.quote;
}

/** One stored entry read back, or null when it is not a usable reference. An
 * entry with no kind is a block reference, which is every entry `CA_0020`
 * wrote, so every stored session survives. */
function readReference(entry: unknown): Reference | null {
  if (typeof entry !== "object" || entry === null) return null;
  const held = entry as Record<string, unknown>;
  const { blockId, number, kind } = held;
  if (typeof blockId !== "string" || blockId === "") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    return null;
  }
  switch (kind) {
    case undefined:
    case "block":
      return { kind: "block", blockId, number };
    case "passage": {
      const anchor = readAnchor(held["anchor"]);
      return anchor === null
        ? null
        : { kind: "passage", blockId, number, anchor };
    }
    default:
      return null;
  }
}

/**
 * Reads a stored marking session back.
 *
 * Anything that is not one answers as nothing marked, because a session that
 * cannot be read is a session there is no evidence of. Numbers are taken as
 * stored rather than renumbered on the way in: a reader who left `#2` and `#4`
 * standing comes back to `#2` and `#4`. No two references keep one number,
 * no block keeps two block references, and no passage is kept twice.
 */
export function parseMarking(raw: string | null): Marking {
  if (raw === null) return NO_MARKING;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_MARKING;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return NO_MARKING;
  }
  const record = value as Record<string, unknown>;
  const references: Reference[] = [];
  const stored = Array.isArray(record["references"])
    ? record["references"]
    : [];
  for (const entry of stored as unknown[]) {
    const reference = readReference(entry);
    if (reference === null) continue;
    const clashes = references.some(
      (kept) =>
        kept.number === reference.number || samePointing(kept, reference),
    );
    if (!clashes) references.push(reference);
  }
  const highest = references.reduce(
    (top, held) => Math.max(top, held.number),
    0,
  );
  // The counter has to stand above every number still marked, whatever was
  // stored: a next number a standing mark already carries would put two
  // references under one number.
  const next = record["next"];
  return {
    mode: record["mode"] === "command" ? "command" : "reading",
    references,
    next:
      typeof next === "number" && Number.isInteger(next) && next > highest
        ? next
        : highest + 1,
  };
}

/** What is written back, or `null` for a session there is nothing to keep of. */
export function serializeMarking(marking: Marking): string | null {
  if (marking.mode === "reading" && marking.references.length === 0) {
    return null;
  }
  return JSON.stringify({
    mode: marking.mode,
    references: marking.references,
    next: marking.next,
  });
}
