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
export const DOCUMENT_KIND = "documents:document";

/** Where the work of a command aimed at a document goes. */
export const DOCUMENT_DELIVERIES = ["propose", "answer"] as const;
export type Delivery = (typeof DOCUMENT_DELIVERIES)[number];

/** A command given with nothing open starts a document, and the one delivery
 * that names no artifact is that start. BO_0251_006 */
export const START = "start";

/** Every delivery the kernel's intake takes. */
export const DELIVERIES = [...DOCUMENT_DELIVERIES, START] as const;

export const isDelivery = (value: unknown): value is Delivery =>
  typeof value === "string" &&
  (DOCUMENT_DELIVERIES as readonly string[]).includes(value);

/**
 * Where a command aimed at nothing goes: into a document the run starts, or
 * answered in the console, which sends no delivery at all. The reader's
 * choice, kept beside the document's (`DeliveryChoice`) as the one choice for
 * commands aimed at nothing. BO_0251_006
 */
export type UnaimedDelivery = typeof START | "answer";

/** Start is what a command with nothing open asks for until the reader says otherwise. */
export const NO_UNAIMED: UnaimedDelivery = START;

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

export interface DocumentTarget {
  /** The document's identity — the one the document tools take. */
  readonly artifact: string;
  readonly delivery: Delivery;
  /** What the reader marked, in mark order. */
  readonly references: readonly SentReference[];
}

/** A command with nothing open that starts a document: no artifact and no
 * references, since the document does not exist yet. BO_0251_006 */
export interface StartTarget {
  readonly delivery: typeof START;
}

export type CommandTarget = DocumentTarget | StartTarget;

/** The document a target is aimed at, or null for a start. */
export const artifactOf = (target: CommandTarget | null): string | null =>
  target !== null && "artifact" in target ? target.artifact : null;

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
 * What a command sent from this tab is aimed at: its document, a start when no
 * document is active and the reader has not dismissed it, or null when it is
 * answered in the console with nothing aimed at. The references are copied out in mark order, so what is sent is
 * the reader's marks as they stood at the press and not a view onto them —
 * and the composer's disclosure lists them from this same value, so what it
 * shows and what is sent cannot differ.
 */
export function commandTarget(
  tab: { readonly kind: string; readonly itemId: string | null } | undefined,
  choice: DeliveryChoice,
  pointing: Readonly<Record<string, Pointing>>,
  unaimed: UnaimedDelivery,
): CommandTarget | null {
  const artifact = documentOf(tab);
  if (artifact === null) return unaimed === START ? { delivery: START } : null;
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
  if (artifact !== "" && body.delivery === START) {
    return { ok: false, error: "A started document is not delivered into an open one." };
  }
  if (artifact === "" && body.delivery === START) {
    return body.references === undefined
      ? { ok: true, target: { delivery: START } }
      : {
          ok: false,
          error: "A started document carries no references: they need the document they point into.",
        };
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
      error: `A command aimed at a document says where its work goes: ${DOCUMENT_DELIVERIES.join(" or ")}.`,
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

/**
 * The document a run started from a command created, once the run has ended
 * naming it — completed, failed or cancelled, since a run that failed may
 * already have staged it — or null while it runs or when it created none.
 * BO_0251_007
 */
export function startedDocument<E extends { readonly kind: string; readonly document?: string }>(
  events: readonly E[],
): string | null {
  for (const event of events) {
    if (
      (event.kind === "runCompleted" || event.kind === "runFailed" || event.kind === "runCancelled") &&
      event.document !== undefined &&
      event.document !== ""
    ) {
      return event.document;
    }
  }
  return null;
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

/** The most files one command carries, and the most one file may weigh:
 * decided by the user on 2026-09-10, and refused by the kernel too.
 * BO_0229_010 */
export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** What a run can read of an attachment, as the kernel classified it. */
export const TEXT_STATUSES = ["text", "extracted", "empty", "image", "none"] as const;
export type TextStatus = (typeof TEXT_STATUSES)[number];

/** A stored file as the kernel's upload answers it: the original's blob, its
 * extracted text's blob when it has one, and what a run can read of it.
 * BO_0229_008 */
export interface AttachmentDescriptor {
  readonly hash: string;
  readonly size: number;
  readonly mediaType: string;
  readonly filename: string;
  readonly text: { readonly hash: string; readonly size: number } | null;
  readonly textStatus: TextStatus;
}

export type ReadAttachments =
  | { readonly ok: true; readonly attachments: readonly AttachmentDescriptor[] }
  | { readonly ok: false; readonly error: string };

const HASH = /^sha256:[0-9a-f]{64}$/u;

/**
 * The attachments a run request carries, read back from its body: absent is
 * none, and a list that is not one, holds more than ten, or holds a
 * descriptor the upload never answers is refused by name rather than
 * forwarded. BO_0229_009
 */
export function readAttachments(value: unknown): ReadAttachments {
  if (value === undefined) return { ok: true, attachments: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "Attachments must be a list of the files the upload answered." };
  }
  if (value.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `A command carries at most ${MAX_ATTACHMENTS} files; this one carries ${value.length}.` };
  }
  const attachments: AttachmentDescriptor[] = [];
  for (const [index, entry] of (value as unknown[]).entries()) {
    const descriptor = readDescriptor(entry);
    if (typeof descriptor === "string") {
      return { ok: false, error: `Attachment ${index + 1} ${descriptor}` };
    }
    attachments.push(descriptor);
  }
  return { ok: true, attachments };
}

function readDescriptor(entry: unknown): AttachmentDescriptor | string {
  if (entry === null || typeof entry !== "object") return "is not a file the upload answered.";
  const { hash, size, mediaType, filename, text, textStatus } = entry as Record<string, unknown>;
  if (typeof hash !== "string" || !HASH.test(hash)) return "is missing its hash.";
  if (typeof size !== "number" || !Number.isInteger(size) || size < 0) return "is missing its size.";
  if (typeof mediaType !== "string" || mediaType === "") return "is missing its media type.";
  if (typeof filename !== "string" || filename.trim() === "") return "is missing its name.";
  if (typeof textStatus !== "string" || !(TEXT_STATUSES as readonly string[]).includes(textStatus)) {
    return "is missing what a run can read of it.";
  }
  let readText: AttachmentDescriptor["text"] = null;
  if (text !== undefined && text !== null) {
    const { hash: textHash, size: textSize } = text as Record<string, unknown>;
    if (typeof textHash !== "string" || !HASH.test(textHash) || typeof textSize !== "number") {
      return "names its text without a hash and size.";
    }
    readText = { hash: textHash, size: textSize };
  }
  return { hash, size, mediaType, filename, text: readText, textStatus: textStatus as TextStatus };
}

/** A size in the words a chip shows it: bytes, KB or MB. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What a run was given of an attachment, in the process detail's words. BO_0229_011 */
export function deliveredWords(delivered: string): string {
  switch (delivered) {
    case "text":
      return "read as text";
    case "image":
      return "seen as an image";
    default:
      return "name, type and size only";
  }
}
