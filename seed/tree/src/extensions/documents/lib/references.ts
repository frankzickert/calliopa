import {
  quotable,
  resolvePassage,
  type PassageAnchor,
  type PassageRange,
} from "~/lib/passage";

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

/**
 * What a reference points at and how it was when the reader marked it
 * (BO_0263_004). A block of the document names nothing more than its block,
 * as every record before this change did; a proposal names its group and its
 * item, and a retired block says so. The revision the reader saw is kept so
 * the run is told about it as it was then; the words and the proposer are
 * kept to show a reference whose row has gone, and whether the block was
 * discarded when marked, so what happened since can be said.
 */
export interface Marked {
  readonly target?: "proposal" | "retired";
  readonly group?: string;
  readonly item?: string;
  readonly revisionId?: string;
  readonly words?: string;
  readonly proposer?: string;
  readonly discarded?: boolean;
}

export interface BlockReference extends Marked {
  readonly kind: "block";
  readonly blockId: string;
  readonly number: number;
}

export interface PassageReference extends Marked {
  readonly kind: "passage";
  readonly blockId: string;
  readonly number: number;
  readonly anchor: PassageAnchor;
}

export type Reference = BlockReference | PassageReference;

/** A prompt block's marking session: what is marked from it, in mark order,
 * and the number the next mark takes, with the mode the surface is in while
 * it points. Marks belong to the prompt block they were made from (`BO_0267`),
 * so each prompt numbers its own from `#1`. */
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

/** Device-local and per prompt block: marking is presentation state, never
 * graph truth, and it does not follow the reader to another device. The
 * record a document kept before marks belonged to a block is
 * `legacyMarkingKey`'s, dropped on the way in. BO_0267_013 */
export const markingKey = (documentId: string, prompt: string): string =>
  `calliopa.marking.${documentId}.${prompt}`;

export const legacyMarkingKey = (documentId: string): string =>
  `calliopa.marking.${documentId}`;

/** Which row a mark stands on: a proposal's item, a retired block, or a
 * block of the document. BO_0263_004 */
export type RowOf =
  | { readonly target?: undefined }
  | { readonly target: "proposal"; readonly item: string }
  | { readonly target: "retired" };

/** The row a reference stands on, as one string: two references on one row
 * are the same pointing. */
export const rowKey = (blockId: string, at: RowOf | Marked = {}): string =>
  at.target === "proposal"
    ? `proposal:${at.item ?? ""}`
    : at.target === "retired"
      ? `retired:${blockId}`
      : blockId;

/** The number of the whole-row reference to this row, or null. */
export const referenceFor = (
  marking: Marking,
  blockId: string,
  at: RowOf = {},
): number | null =>
  marking.references.find(
    (held) => held.kind === "block" && rowKey(held.blockId, held) === rowKey(blockId, at),
  )?.number ?? null;

/** The passages marked inside this row, in mark order. */
export const passagesIn = (
  marking: Marking,
  blockId: string,
  at: RowOf = {},
): readonly PassageReference[] =>
  marking.references.filter(
    (held): held is PassageReference =>
      held.kind === "passage" && rowKey(held.blockId, held) === rowKey(blockId, at),
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
export function toggleReference(
  marking: Marking,
  blockId: string,
  marked: Marked = {},
): Marking {
  const at = rowKey(blockId, marked);
  if (marking.references.some((held) => held.kind === "block" && rowKey(held.blockId, held) === at)) {
    return keeping(
      marking,
      marking.references.filter(
        (held) => !(held.kind === "block" && rowKey(held.blockId, held) === at),
      ),
    );
  }
  return appending(marking, { kind: "block", blockId, number: marking.next, ...marked });
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
  marked: Marked = {},
): Marking {
  if (!quotable(anchor.quote)) return marking;
  if (
    passagesIn(marking, blockId, rowOf(marked)).some(
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
    ...marked,
  });
}

/** The row a marked target stands on. */
const rowOf = (marked: Marked): RowOf =>
  marked.target === "proposal"
    ? { target: "proposal", item: marked.item ?? "" }
    : marked.target === "retired"
      ? { target: "retired" }
      : {};

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

/** What the document holds now, as `followDocument` reads it: its blocks
 * with the revision each stands at, and the proposal items still open — null
 * while they have not been read, since an item not yet read is not one that
 * was answered. */
export interface DocumentNow {
  readonly blocks: readonly { readonly blockId: string; readonly revisionId: string }[];
  readonly openItems: ReadonlySet<string> | null;
}

/**
 * Keeps each reference as what was marked, following it only where the
 * document says what it became (BO_0263_004).
 *
 * A reference is never dropped because its row has gone: a proposal answered,
 * a block retired or discarded, a retired block restored — the run is told it
 * as it was marked, and the reader takes it back from its chip. A proposal
 * that was accepted became a block of the document under the revision the
 * reader marked, so its number moves to that block. Only a reference from
 * before this change, which names no revision, is dropped when its block has
 * gone: there is nothing to tell the run about it as it was.
 */
export function followDocument(marking: Marking, now: DocumentNow): Marking {
  const revisions = new Map(now.blocks.map((block) => [block.blockId, block.revisionId]));
  let changed = false;
  const references: Reference[] = [];
  for (const held of marking.references) {
    if (held.target === undefined && held.revisionId === undefined && !revisions.has(held.blockId)) {
      changed = true;
      continue;
    }
    if (
      held.target === "proposal" &&
      now.openItems !== null &&
      !now.openItems.has(held.item ?? "") &&
      held.revisionId !== undefined &&
      revisions.get(held.blockId) === held.revisionId
    ) {
      const { target: _target, group: _group, item: _item, proposer: _proposer, ...block } = held;
      // Another reference may already point at the block it became; the one
      // marked first keeps the row.
      if (!references.some((kept) => kept.kind === held.kind && samePointing(kept, block))) {
        references.push(block);
      }
      changed = true;
      continue;
    }
    references.push(held);
  }
  return changed ? keeping(marking, references) : marking;
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

/** Whether two references point at the same thing: one row, or the same
 * words of one row. */
function samePointing(a: Reference, b: Reference): boolean {
  if (rowKey(a.blockId, a) !== rowKey(b.blockId, b)) return false;
  if (a.kind === "block") return b.kind === "block";
  return b.kind === "passage" && a.anchor.quote === b.anchor.quote;
}

/** What was marked, read back from a stored entry; an entry naming none of
 * it is a block of the document, as every record before BO_0263 is. */
function readMarkedEntry(held: Record<string, unknown>): Marked | null {
  const text = (key: string): string | undefined =>
    typeof held[key] === "string" && held[key] !== "" ? (held[key] as string) : undefined;
  const target = held["target"];
  if (target !== undefined && target !== "proposal" && target !== "retired") return null;
  if (target === "proposal" && (text("group") === undefined || text("item") === undefined)) return null;
  const marked: Marked = {
    ...(target === undefined ? {} : { target }),
    ...(target === "proposal" ? { group: text("group") as string, item: text("item") as string } : {}),
    ...(text("revisionId") === undefined ? {} : { revisionId: text("revisionId") as string }),
    ...(text("words") === undefined ? {} : { words: text("words") as string }),
    ...(text("proposer") === undefined ? {} : { proposer: text("proposer") as string }),
    ...(held["discarded"] === true ? { discarded: true } : {}),
  };
  return marked;
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
  const marked = readMarkedEntry(held);
  if (marked === null) return null;
  switch (kind) {
    case undefined:
    case "block":
      return { kind: "block", blockId, number, ...marked };
    case "passage": {
      const anchor = readAnchor(held["anchor"]);
      return anchor === null
        ? null
        : { kind: "passage", blockId, number, anchor, ...marked };
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
  // The mode is not kept: pointing ends with the page, and a prompt's marks
  // come back without it. BO_0267_013
  return {
    mode: "reading",
    references,
    next:
      typeof next === "number" && Number.isInteger(next) && next > highest
        ? next
        : highest + 1,
  };
}

/** What is written back, or `null` for a session there is nothing to keep of. */
export function serializeMarking(marking: Marking): string | null {
  if (marking.references.length === 0) return null;
  return JSON.stringify({
    references: marking.references,
    next: marking.next,
  });
}

/**
 * A prompt's marks as its latest run carried them, for a device that holds
 * none of its own: each reference as it was sent, a passage anchored by its
 * words alone. BO_0267_013
 */
export function markingFromSent(
  sent: readonly {
    readonly number: number;
    readonly blockId: string;
    readonly kind?: string;
    readonly quote?: string;
    readonly target?: string;
    readonly group?: string;
    readonly item?: string;
    readonly revisionId?: string;
  }[],
): Marking {
  const raw = JSON.stringify({
    references: sent.map((reference) => {
      const marked = {
        ...(reference.target === "proposal" || reference.target === "retired" ? { target: reference.target } : {}),
        ...(reference.group === undefined ? {} : { group: reference.group }),
        ...(reference.item === undefined ? {} : { item: reference.item }),
        ...(reference.revisionId === undefined ? {} : { revisionId: reference.revisionId }),
      };
      return reference.kind === "passage" && reference.quote !== undefined
        ? { kind: "passage", number: reference.number, blockId: reference.blockId, anchor: { quote: reference.quote, prefix: "", suffix: "", hint: 0 }, ...marked }
        : { kind: "block", number: reference.number, blockId: reference.blockId, ...marked };
    }),
  });
  return parseMarking(raw);
}
