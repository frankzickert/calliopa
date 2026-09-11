import { quotable } from "./passage";

/**
 * What a command from the composer is aimed at, and where its work goes.
 * `BO_0226`
 *
 * A command issued while a document is open is aimed at that document. The
 * reader says whether the run proposes into it or answers in words, and the
 * blocks they marked in command mode travel with it as pointing. All three are
 * fields rather than words in the goal, for the reason the kernel gives about
 * a run's intention: *a selector that recovers the intention by parsing prose
 * is not a rule*. The first run that executed from an open document was told
 * none of them, searched the web, and answered in the console.
 *
 * Pure, because what is sent is the part worth being sure of: the composer
 * builds a target with `commandTarget` and the route reads one back with
 * `readCommandTarget`, and neither needs a browser to check.
 */

/** The one tab kind a command can be aimed at. Another kind has no propose
 * path of this shape — an extension's is staging its source, which a run does
 * by default — so it names no artifact at all. */
export const DOCUMENT_KIND = "ui.shell:document";

export const DELIVERIES = ["propose", "answer"] as const;
export type Delivery = (typeof DELIVERIES)[number];

export const isDelivery = (value: unknown): value is Delivery =>
  typeof value === "string" &&
  (DELIVERIES as readonly string[]).includes(value);

/**
 * A reference as it travels to the run: a block, or a passage carrying its
 * exact words. The anchor's context and position hint stay in the browser —
 * they only tell repeated words apart, and the run is told the words.
 * BO_0227_008
 */
export type SentReference =
  | {
      readonly kind: "block";
      readonly number: number;
      readonly blockId: string;
    }
  | {
      readonly kind: "passage";
      readonly number: number;
      readonly blockId: string;
      readonly quote: string;
    };

/**
 * A reference as the view reports it: what will be sent, the words it stands
 * for — a passage's quote, a block's opening — and whether a passage is
 * stale. The words and the staleness are for the composer to show and to
 * refuse on; they are never sent.
 */
export type PointedReference = SentReference & {
  readonly words: string;
  readonly stale: boolean;
};

/** A pinned block as the composer shows it. The kernel reads what is pinned
 * from the graph at the run's start, so this is shown and never sent. */
export interface PinnedBlock {
  readonly blockId: string;
  readonly words: string;
}

/** What the reader is pointing at in one document, as its view last reported. */
export interface Pointing {
  readonly references: readonly PointedReference[];
  readonly pinned: readonly PinnedBlock[];
}

export const NO_POINTING: Pointing = { references: [], pinned: [] };

/** The numbers of the passages that no longer match their words. A command
 * carrying one is refused until it is re-pointed or taken back. */
export const staleIn = (pointing: Pointing): readonly number[] =>
  pointing.references
    .filter((reference) => reference.kind === "passage" && reference.stale)
    .map((reference) => reference.number);

export interface CommandTarget {
  /** The document's identity — the one the document tools take. */
  readonly artifact: string;
  readonly delivery: Delivery;
  /** What the reader marked, in mark order. */
  readonly references: readonly SentReference[];
}

/** A reported reference with what is only shown taken off. */
export const sent = (reference: PointedReference): SentReference =>
  reference.kind === "passage"
    ? {
        kind: "passage",
        number: reference.number,
        blockId: reference.blockId,
        quote: reference.quote,
      }
    : { kind: "block", number: reference.number, blockId: reference.blockId };

/**
 * The reader's delivery choice, remembered for the document it was made in.
 *
 * Kept with the document rather than on its own, so a choice lapses when the
 * reader moves to another document: a deliberate *Answer* in one must never
 * govern a command in the next, and propose is what a document asks for until
 * the reader says otherwise.
 */
export interface DeliveryChoice {
  readonly itemId: string | null;
  readonly delivery: Delivery;
}

export const NO_CHOICE: DeliveryChoice = { itemId: null, delivery: "propose" };

export const deliveryFor = (
  itemId: string,
  choice: DeliveryChoice,
): Delivery => (choice.itemId === itemId ? choice.delivery : "propose");

/** The document a tab shows, or null for a tab that is not a document. */
export const documentOf = (
  tab: { readonly kind: string; readonly itemId: string | null } | undefined,
): string | null =>
  tab !== undefined &&
  tab.kind === DOCUMENT_KIND &&
  tab.itemId !== null &&
  tab.itemId !== ""
    ? tab.itemId
    : null;

/**
 * What a command sent from this tab is aimed at, or null when it is aimed at
 * nothing. The references are copied out in mark order, so what is sent is
 * the reader's marks as they stood at the press and not a view onto them —
 * and the composer's disclosure lists them from this same value, so what it
 * shows and what is sent cannot differ.
 */
export function commandTarget(
  tab: { readonly kind: string; readonly itemId: string | null } | undefined,
  choice: DeliveryChoice,
  pointing: Readonly<Record<string, Pointing>>,
): CommandTarget | null {
  const artifact = documentOf(tab);
  if (artifact === null) return null;
  return {
    artifact,
    delivery: deliveryFor(artifact, choice),
    references: (pointing[artifact] ?? NO_POINTING).references.map(sent),
  };
}

export type ReadTarget =
  | { readonly ok: true; readonly target: CommandTarget | null }
  | { readonly ok: false; readonly error: string };

/**
 * A target read back from a request body.
 *
 * A malformed list is answered here rather than forwarded: the kernel refuses
 * an incoherent one too, but a shape the shell itself never sends is the
 * shell's to name. A body with no artifact is a command aimed at nothing, and
 * a delivery or references without one are refused rather than dropped, since
 * dropping them would run a command the reader aimed somewhere as if they had
 * not.
 */
export function readCommandTarget(body: {
  readonly artifact?: unknown;
  readonly delivery?: unknown;
  readonly references?: unknown;
}): ReadTarget {
  const artifact =
    typeof body.artifact === "string" ? body.artifact.trim() : "";
  if (body.artifact !== undefined && typeof body.artifact !== "string") {
    return { ok: false, error: "The artifact must be a document's identity." };
  }
  if (artifact === "") {
    if (body.delivery !== undefined || body.references !== undefined) {
      return {
        ok: false,
        error: "A delivery and references need the document they are aimed at.",
      };
    }
    return { ok: true, target: null };
  }
  // Never defaulted: the delivery is the reader's to state, and a command
  // aimed at a document that does not say where its work goes is refused
  // rather than given the answer this module would guess.
  const delivery = body.delivery;
  if (!isDelivery(delivery)) {
    return {
      ok: false,
      error: `A command aimed at a document says where its work goes: ${DELIVERIES.join(" or ")}.`,
    };
  }
  const listed = body.references ?? [];
  if (!Array.isArray(listed)) {
    return { ok: false, error: MALFORMED_REFERENCES };
  }
  const references: SentReference[] = [];
  for (const entry of listed as unknown[]) {
    const reference = readReference(entry);
    if (typeof reference === "string") return { ok: false, error: reference };
    references.push(reference);
  }
  return { ok: true, target: { artifact, delivery, references } };
}

const MALFORMED_REFERENCES =
  "References must be a list of {number, blockId}, a passage also carrying kind and quote.";

/** One reference read back from a body, or the refusal naming what is wrong
 * with it. An entry with no kind is a block reference, as `BO_0226` sent
 * them. BO_0227_008 */
function readReference(entry: unknown): SentReference | string {
  if (typeof entry !== "object" || entry === null) return MALFORMED_REFERENCES;
  const { number, blockId, kind, quote } = entry as Record<string, unknown>;
  if (
    typeof number !== "number" ||
    !Number.isInteger(number) ||
    number < 1 ||
    typeof blockId !== "string" ||
    blockId.trim() === ""
  ) {
    return MALFORMED_REFERENCES;
  }
  switch (kind) {
    case undefined:
    case "block":
      return quote === undefined
        ? { kind: "block", number, blockId: blockId.trim() }
        : `Block reference #${number} carries a quote; only a passage does.`;
    case "passage":
      // Taken as sent: a passage is anchored by its exact words, whitespace
      // included.
      return typeof quote === "string" && quotable(quote)
        ? { kind: "passage", number, blockId: blockId.trim(), quote }
        : `Passage #${number} must quote some words, and no more than a passage holds.`;
    default:
      return `Reference #${number} is neither a block nor a passage.`;
  }
}

/** The shell's report of the last run aimed at a document that ended. */
export interface EndedRun {
  readonly itemId: string | null;
  readonly seq: number;
}

/**
 * Whether a view showing `documentId` acts on the shell's latest ended run,
 * and the count it has seen once it has looked.
 *
 * A view starts having seen whatever count stood when it opened, so a run
 * that ended before the reader opened the document is not acted on again —
 * the proposals are read on the way in regardless. A run aimed at another
 * document is seen and passed over. BO_0226_007
 */
export function proposedFor(
  ended: EndedRun,
  seen: number,
  documentId: string | null,
): { readonly seen: number; readonly act: boolean } {
  if (ended.seq === seen) return { seen, act: false };
  return {
    seen: ended.seq,
    act: documentId !== null && ended.itemId === documentId,
  };
}

/**
 * What a chip in the composer asks the view to show: a block, for a block
 * reference or a pinned block, or a passage by its number in its block. The
 * view holds the passage's anchor, so the number is all it needs to find the
 * words. CA_0039_004
 */
export type RevealTarget =
  | { readonly kind: "block"; readonly blockId: string }
  | {
      readonly kind: "passage";
      readonly blockId: string;
      readonly number: number;
    };

export const revealTarget = (
  shown: PointedReference | PinnedBlock,
): RevealTarget =>
  "kind" in shown && shown.kind === "passage"
    ? { kind: "passage", blockId: shown.blockId, number: shown.number }
    : { kind: "block", blockId: shown.blockId };

/** The shell's last reveal request: which document, what to show, and a
 * count that rises with every press. */
export interface RevealRequest {
  readonly itemId: string | null;
  readonly target: RevealTarget | null;
  readonly seq: number;
}

/**
 * What a view showing `documentId` reveals for the shell's latest request,
 * and the count it has seen once it has looked. The rule is `proposedFor`'s:
 * a press made before the view opened is not acted on, and a press for
 * another document is seen and passed over, so a second press on the same
 * chip reveals again. CA_0039_004
 */
export function revealFor(
  request: RevealRequest,
  seen: number,
  documentId: string | null,
): { readonly seen: number; readonly target: RevealTarget | null } {
  const looked = proposedFor(request, seen, documentId);
  return { seen: looked.seen, target: looked.act ? request.target : null };
}
