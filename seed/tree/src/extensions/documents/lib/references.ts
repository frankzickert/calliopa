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
  /** The document the reference points into when it is not the prompt's
   * own, and its title as the reader saw it — absent for the prompt's own
   * document, so every record before `BO_0304` reads unchanged. BO_0304_007 */
  readonly document?: string;
  readonly documentTitle?: string;
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

/** A document marked whole (`BO_0304_007`): named by identity, with its title
 * as the reader saw it, numbered in the one sequence with the rest. */
export interface DocumentReference {
  readonly kind: "document";
  readonly document: string;
  readonly documentTitle?: string;
  readonly number: number;
  /** Never on a document marked whole; named so a list of references of
   * every kind reads them without a case. */
  readonly blockId?: undefined;
  readonly target?: undefined;
}

export type Reference = BlockReference | PassageReference | DocumentReference;

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
  | { readonly target?: undefined; readonly document?: string }
  | { readonly target: "proposal"; readonly item: string; readonly document?: string }
  | { readonly target: "retired"; readonly document?: string };

/** The row a reference stands on, as one string: two references on one row
 * are the same pointing. A row of another document is told apart by that
 * document (`BO_0304_007`); a row named with no document is the prompt's
 * own. */
export const rowKey = (blockId: string, at: RowOf | Marked = {}): string => {
  const row =
    at.target === "proposal"
      ? `proposal:${at.item ?? ""}`
      : at.target === "retired"
        ? `retired:${blockId}`
        : blockId;
  return at.document === undefined ? row : `${at.document}//${row}`;
};

/** The number of the whole-row reference to this row, or null. */
export const referenceFor = (
  marking: Marking,
  blockId: string,
  at: RowOf = {},
): number | null =>
  marking.references.find(
    (held) => held.kind === "block" && rowKey(held.blockId, held) === rowKey(blockId, at),
  )?.number ?? null;

/** The number of the reference to this document marked whole, or null.
 * BO_0304_007 */
export const documentReferenceFor = (marking: Marking, document: string): number | null =>
  marking.references.find((held) => held.kind === "document" && held.document === document)?.number ?? null;

/** The documents marked whole, with their titles and numbers, in mark order:
 * what the library and the tab strip show. BO_0304_007 */
export const documentsMarked = (
  marking: Marking,
): readonly { readonly document: string; readonly title: string; readonly number: number }[] =>
  marking.references.flatMap((held) =>
    held.kind === "document" ? [{ document: held.document, title: held.documentTitle ?? held.document, number: held.number }] : [],
  );

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
 * Marks a document whole, or takes the mark back, under the rules of
 * `toggleReference`: appending numbers in mark order, and unmarking leaving
 * every standing number where it is. BO_0304_007
 */
export function toggleDocument(marking: Marking, document: string, documentTitle?: string): Marking {
  if (marking.references.some((held) => held.kind === "document" && held.document === document)) {
    return keeping(
      marking,
      marking.references.filter((held) => !(held.kind === "document" && held.document === document)),
    );
  }
  return appending(marking, {
    kind: "document",
    document,
    number: marking.next,
    ...(documentTitle === undefined ? {} : { documentTitle }),
  });
}

/**
 * Localizes the marks of a pointing session for a guest view of another
 * document (`BO_0304_008`): the references pointing into `document` stand as
 * that view's own rows and passages, the rest — the prompt's own document's,
 * other documents', the documents marked whole — are left out, since no row
 * of the guest carries them. The numbers are the session's, so what the
 * guest draws is what the prompt's chips say.
 */
export function localizeMarking(marking: Marking, document: string): Marking {
  const references = marking.references.flatMap((held): Reference[] => {
    if (held.kind === "document" || held.document !== document) return [];
    const { document: _document, documentTitle: _title, ...local } = held;
    return [local as Reference];
  });
  return { mode: "command", references, next: marking.next };
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
const rowOf = (marked: Marked): RowOf => {
  const where = marked.document === undefined ? {} : { document: marked.document };
  return marked.target === "proposal"
    ? { target: "proposal", item: marked.item ?? "", ...where }
    : marked.target === "retired"
      ? { target: "retired", ...where }
      : where;
};

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
    // What points into another document, or at one whole, is what was
    // marked: this document says nothing about it. BO_0304_007
    if (held.kind === "document" || held.document !== undefined) {
      references.push(held);
      continue;
    }
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

/** Whether two references point at the same thing: one row, the same words
 * of one row, or one document marked whole. */
function samePointing(a: Reference, b: Reference): boolean {
  if (a.kind === "document" || b.kind === "document") {
    return a.kind === "document" && b.kind === "document" && a.document === b.document;
  }
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
    ...(text("document") === undefined ? {} : { document: text("document") as string }),
    ...(text("documentTitle") === undefined ? {} : { documentTitle: text("documentTitle") as string }),
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
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    return null;
  }
  // A document marked whole names its document and no block. BO_0304_007
  if (kind === "document") {
    const document = held["document"];
    if (typeof document !== "string" || document === "") return null;
    const title = held["documentTitle"];
    return { kind: "document", document, number, ...(typeof title === "string" && title !== "" ? { documentTitle: title } : {}) };
  }
  if (typeof blockId !== "string" || blockId === "") return null;
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
    readonly blockId?: string;
    readonly kind?: string;
    readonly quote?: string;
    readonly target?: string;
    readonly group?: string;
    readonly item?: string;
    readonly revisionId?: string;
    readonly document?: string;
  }[],
): Marking {
  const raw = JSON.stringify({
    references: sent.map((reference) => {
      const marked = {
        ...(reference.target === "proposal" || reference.target === "retired" ? { target: reference.target } : {}),
        ...(reference.group === undefined ? {} : { group: reference.group }),
        ...(reference.item === undefined ? {} : { item: reference.item }),
        ...(reference.revisionId === undefined ? {} : { revisionId: reference.revisionId }),
        ...(reference.document === undefined ? {} : { document: reference.document }),
      };
      // A document marked whole comes back as one; its title is not in the
      // run's record, so the chip names it by identity until it is marked
      // again. BO_0304_007
      if (reference.kind === "document") {
        return { kind: "document", number: reference.number, document: reference.document ?? "" };
      }
      return reference.kind === "passage" && reference.quote !== undefined
        ? { kind: "passage", number: reference.number, blockId: reference.blockId, anchor: { quote: reference.quote, prefix: "", suffix: "", hint: 0 }, ...marked }
        : { kind: "block", number: reference.number, blockId: reference.blockId, ...marked };
    }),
  });
  return parseMarking(raw);
}
