/**
 * What a reader has pointed at in one document, and how it is kept.
 *
 * A reference identifies a block by its identity. The number is a human-facing
 * alias for it, never the thing it points at, so reordering or restructuring a
 * document retargets nothing.
 *
 * Pure, because where a number comes from is the part worth being sure of: a
 * mark keeps the number it was given for as long as it stands, and a number is
 * retired with its mark rather than handed to the next one.
 */

/** The one mode the block editor surface is in. Reading is the resting state
 * and not a mode the reader selects; command is one they enter and leave. */
export type EditorMode = "reading" | "command";

export interface Reference {
  readonly blockId: string;
  readonly number: number;
}

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

export const referenceFor = (
  marking: Marking,
  blockId: string,
): number | null =>
  marking.references.find((held) => held.blockId === blockId)?.number ?? null;

/**
 * Marks a block, or takes the mark back.
 *
 * Marking appends, so numbers rise in the order the reader marked. Unmarking
 * leaves every standing reference the number it already carries — a block's
 * number never changes under a reader who did not touch it — and the number it
 * carried is not reissued while any mark stands. With nothing marked there is
 * no standing number left to disagree with, so numbering starts again at 1.
 */
export function toggleReference(marking: Marking, blockId: string): Marking {
  if (referenceFor(marking, blockId) !== null) {
    const references = marking.references.filter(
      (held) => held.blockId !== blockId,
    );
    return {
      ...marking,
      references,
      next: references.length === 0 ? 1 : marking.next,
    };
  }
  return {
    ...marking,
    references: [...marking.references, { blockId, number: marking.next }],
    next: marking.next + 1,
  };
}

/**
 * Drops the references whose blocks the document no longer holds.
 *
 * A mark on nothing cannot be drawn, and the document is the only list there
 * is, so an unavailable reference has nowhere to appear. Nothing has been sent
 * that would depend on it having survived.
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
  return {
    ...marking,
    references,
    next: references.length === 0 ? 1 : marking.next,
  };
}

/**
 * Reads a stored marking session back.
 *
 * Anything that is not one answers as nothing marked, because a session that
 * cannot be read is a session there is no evidence of. Numbers are taken as
 * stored rather than renumbered on the way in: a reader who left `#2` and `#4`
 * standing comes back to `#2` and `#4`.
 */
export function parseMarking(raw: string | null): Marking {
  if (raw === null) return NO_MARKING;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_MARKING;
  }
  if (typeof value !== "object" || value === null) return NO_MARKING;
  const record = value as Record<string, unknown>;
  const references: Reference[] = [];
  if (Array.isArray(record["references"])) {
    for (const entry of record["references"]) {
      if (typeof entry !== "object" || entry === null) continue;
      const held = entry as Record<string, unknown>;
      const blockId = held["blockId"];
      const number = held["number"];
      if (typeof blockId !== "string" || blockId === "") continue;
      if (typeof number !== "number" || !Number.isInteger(number)) continue;
      if (number < 1) continue;
      if (references.some((kept) => kept.blockId === blockId)) continue;
      references.push({ blockId, number });
    }
  }
  const stored = record["next"];
  const highest = references.reduce(
    (top, held) => Math.max(top, held.number),
    0,
  );
  // The counter has to stand above every number still marked, whatever was
  // stored: a next number a standing mark already carries would put two blocks
  // under one reference.
  const next =
    typeof stored === "number" && Number.isInteger(stored) && stored > highest
      ? stored
      : highest + 1;
  return {
    mode: record["mode"] === "command" ? "command" : "reading",
    references,
    next,
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
