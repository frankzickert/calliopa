import { quotable } from "./passage";

/**
 * What a command is aimed at, and where its work goes. `BO_0226`
 *
 * A command to a document is written in one of its blocks and sent from there
 * (`BO_0267`): it proposes into that document, names the block and the
 * revision it was sent from, and the blocks the reader marked from it travel
 * with it as pointing. All three are
 * fields rather than words in the goal, for the reason the kernel gives about
 * a run's intention: *a selector that recovers the intention by parsing prose
 * is not a rule*. The first run that executed from an open document was told
 * none of them, searched the web, and answered in the console.
 *
 * Pure, because what is sent is the part worth being sure of: a block's
 * command control builds a target with `blockCommand` and the route reads one
 * back with `readCommandTarget`, and neither needs a browser to check.
 */

/** The one tab kind a command can be aimed at. Another kind has no propose
 * path of this shape — an extension's is staging its source, which a run does
 * by default — so it names no artifact at all. */
export const DOCUMENT_KIND = "documents:document";

/** Where the work of a command aimed at a document goes: into it, always.
 * Answering in words retired under `BO_0267`; a question's answer is a
 * proposed block after the prompt. BO_0267_009 */
export const DOCUMENT_DELIVERIES = ["propose"] as const;
export type Delivery = (typeof DOCUMENT_DELIVERIES)[number];

/** The delivery the kernel still takes that this shell never sends: a
 * command with nothing open started a document until `CA_0058` retired the
 * composer, and the intake keeps it until a change of the kernel retires it
 * too. Named here so the refusal can say what it is. CA_0058_002 */
export const START = "start";

export const isDelivery = (value: unknown): value is Delivery =>
  typeof value === "string" &&
  (DOCUMENT_DELIVERIES as readonly string[]).includes(value);

/**
 * A reference as it travels to the run: a block, or a passage carrying its
 * exact words. The anchor's context and position hint stay in the browser —
 * they only tell repeated words apart, and the run is told the words.
 * BO_0227_008
 *
 * What was marked travels with it (BO_0263_006): a proposal standing against
 * the document names its group and item, a retired block says so, and every
 * reference marked since names the revision the reader saw, which the kernel
 * reads the words and the proposer from. A reference with none of these is a
 * block of the document, as every earlier caller sent it.
 */
export interface MarkedTarget {
  readonly target?: "proposal" | "retired";
  readonly group?: string;
  readonly item?: string;
  readonly revisionId?: string;
}

export type SentReference = MarkedTarget &
  (
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
      }
  );

/**
 * A reference as the view reports it: what will be sent, the words it stands
 * for — a passage's quote, a block's opening — and whether a passage is
 * stale. The words and the staleness are for the composer to show and to
 * refuse on; they are never sent.
 *
 * What it is and what has happened to it since are shown too (BO_0263_007):
 * a proposal and who proposed it, a retired or a discarded block, and
 * *since* — rejected, restored, reopened, retired, discarded. A rowless
 * reference has no row left in the document to carry its number, so its chip
 * is where it is taken back.
 */
export type PointedReference = SentReference & {
  readonly words: string;
  readonly stale: boolean;
  readonly what?: "proposal" | "retired" | "discarded";
  readonly proposer?: string;
  readonly since?: string;
  readonly rowless?: boolean;
};

/** A fixated block as the command control shows it. The kernel reads what is
 * fixated
 * from the graph at the run's start, so this is shown and never sent. */
export interface FixatedBlock {
  readonly blockId: string;
  readonly words: string;
}

/** What the reader is pointing at in one document, as its view last reported. */
export interface Pointing {
  readonly references: readonly PointedReference[];
  readonly fixated: readonly FixatedBlock[];
}

export const NO_POINTING: Pointing = { references: [], fixated: [] };

/** The numbers of the passages that no longer match their words. A command
 * carrying one is refused until it is re-pointed or taken back. */
export const staleIn = (pointing: Pointing): readonly number[] =>
  pointing.references
    .filter((reference) => reference.kind === "passage" && reference.stale)
    .map((reference) => reference.number);

/** The block a command was written in and sent from, and the revision sent:
 * the kernel reads the command's words from it. BO_0267_009 */
export interface CommandSource {
  readonly block: string;
  readonly revisionId: string;
}

export interface DocumentTarget {
  /** The document's identity — the one the document tools take. */
  readonly artifact: string;
  readonly delivery: Delivery;
  /** What the reader marked, in mark order. */
  readonly references: readonly SentReference[];
  /** The block the command was sent from. BO_0267_009 */
  readonly source?: CommandSource;
}

/** Every command is written in a block of a document, so every target names
 * one. CA_0058_002 */
export type CommandTarget = DocumentTarget;

/** A reported reference with what is only shown taken off. */
export const sent = (reference: PointedReference): SentReference => {
  const marked: MarkedTarget = {
    ...(reference.target === undefined ? {} : { target: reference.target }),
    ...(reference.group === undefined ? {} : { group: reference.group }),
    ...(reference.item === undefined ? {} : { item: reference.item }),
    ...(reference.revisionId === undefined ? {} : { revisionId: reference.revisionId }),
  };
  return reference.kind === "passage"
    ? {
        kind: "passage",
        number: reference.number,
        blockId: reference.blockId,
        quote: reference.quote,
        ...marked,
      }
    : { kind: "block", number: reference.number, blockId: reference.blockId, ...marked };
};

/**
 * What the shell holds for the commands a document's blocks send: what the
 * reader has marked in each document, as its view last reported, and the
 * branch each document's tab works in. Keyed by document rather than by tab,
 * as the marks themselves are. BO_0226_005 BO_0250_010
 */
export interface CommandAim {
  pointing: Record<string, Pointing>;
  branch?: Record<string, string>;
}

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
 * A command sent from a block of a document: it proposes into the document,
 * names the block and the revision sent, and carries the block's marks in
 * mark order, copied out so what is sent is the marks as they stood at the
 * press. BO_0267_008
 */
export function blockCommand(
  artifact: string,
  source: CommandSource,
  references: readonly PointedReference[],
): DocumentTarget {
  return { artifact, delivery: "propose", references: references.map(sent), source };
}

export type ReadTarget =
  | { readonly ok: true; readonly target: CommandTarget }
  | { readonly ok: false; readonly error: string };

/**
 * A target read back from a request body.
 *
 * Every command this shell sends is written in a block of a document, so a
 * body names the document, says its work is proposed into it, and names the
 * block it was sent from. A malformed list is answered here rather than
 * forwarded: the kernel refuses an incoherent one too, but a shape the shell
 * itself never sends is the shell's to name. CA_0058_002
 */
/**
 * What a request to start a run is: a gesture or a command (`BO_0258_006`).
 *
 * A gesture asks a named extension a specific question, so it carries a goal
 * and an intention and no block of its own. A command is written in a block,
 * and the kernel reads its words from the revision sent, so a goal beside it
 * would be a second source of the same words (`CA_0058_002`). Each is refused
 * the other's shape rather than quietly taking it.
 */
export type RunShape =
  | { readonly ok: true; readonly gesture: false }
  | { readonly ok: true; readonly gesture: true; readonly intention: string }
  | { readonly ok: false; readonly error: string };

export function readRunShape(body: { readonly goal?: unknown; readonly intention?: unknown }): RunShape {
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const intention = typeof body.intention === "string" ? body.intention.trim() : "";
  if (intention === "") {
    return goal === ""
      ? { ok: true, gesture: false }
      : { ok: false, error: "A command sent from a block carries no goal: its words are the block's." };
  }
  return goal === ""
    ? { ok: false, error: "A gesture carries the question it asks as its goal." }
    : { ok: true, gesture: true, intention };
}

/**
 * A gesture's target: the document it was made in, which its run proposes
 * into. It names no source block and no references, because a gesture is not
 * written anywhere — it asks about the subject it was pressed on, and the
 * question travels as the run's goal. BO_0258_006
 */
export function readGestureTarget(body: { readonly artifact?: unknown }): ReadTarget {
  if (body.artifact !== undefined && typeof body.artifact !== "string") {
    return { ok: false, error: "The artifact must be a document's identity." };
  }
  const artifact = typeof body.artifact === "string" ? body.artifact.trim() : "";
  if (artifact === "") {
    return { ok: false, error: "A gesture names the document it was made in." };
  }
  return { ok: true, target: { artifact, delivery: "propose", references: [] } };
}

export function readCommandTarget(body: {
  readonly artifact?: unknown;
  readonly delivery?: unknown;
  readonly references?: unknown;
  readonly source?: unknown;
}): ReadTarget {
  if (body.artifact !== undefined && typeof body.artifact !== "string") {
    return { ok: false, error: "The artifact must be a document's identity." };
  }
  const artifact = typeof body.artifact === "string" ? body.artifact.trim() : "";
  if (artifact === "") {
    return {
      ok: false,
      error: "A command is written in a block of a document: it names the document its block is in.",
    };
  }
  // Never defaulted: the delivery is the reader's to state, and a command
  // aimed at a document that does not say where its work goes is refused
  // rather than given the answer this module would guess.
  const delivery = body.delivery;
  if (delivery === "answer") {
    return {
      ok: false,
      error: "The answer delivery is retired: a command aimed at a document proposes into it, a question's answer included.",
    };
  }
  if (delivery === START) {
    return {
      ok: false,
      error: "Starting a document from a command is retired: a command is written in a block of the document it works in.",
    };
  }
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
  if (body.source === undefined) {
    return {
      ok: false,
      error: "A command names the block it was sent from and the revision sent.",
    };
  }
  const source = readSource(body.source);
  if (typeof source === "string") return { ok: false, error: source };
  return { ok: true, target: { artifact, delivery, references, source } };
}

/** The block a command was sent from, read back from a body, or the refusal
 * naming what is missing. BO_0267_009 */
function readSource(value: unknown): CommandSource | string {
  if (typeof value !== "object" || value === null) {
    return "A command's source is the block it was sent from and the revision sent.";
  }
  const { block, revisionId } = value as Record<string, unknown>;
  if (typeof block !== "string" || block.trim() === "") return "A command's source names no block.";
  if (typeof revisionId !== "string" || revisionId.trim() === "") {
    return `A command's source block ${block.trim()} names no revision.`;
  }
  return { block: block.trim(), revisionId: revisionId.trim() };
}

const MALFORMED_REFERENCES =
  "References must be a list of {number, blockId}, a passage also carrying kind and quote.";

/** One reference read back from a body, or the refusal naming what is wrong
 * with it. An entry with no kind is a block reference, as `BO_0226` sent
 * them. BO_0227_008 */
function readReference(entry: unknown): SentReference | string {
  if (typeof entry !== "object" || entry === null) return MALFORMED_REFERENCES;
  const { number, blockId, kind, quote } = entry as Record<string, unknown>;
  const marked = readMarked(entry as Record<string, unknown>, number);
  if (typeof marked === "string") return marked;
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
        ? { kind: "block", number, blockId: blockId.trim(), ...marked }
        : `Block reference #${number} carries a quote; only a passage does.`;
    case "passage":
      // Taken as sent: a passage is anchored by its exact words, whitespace
      // included.
      return typeof quote === "string" && quotable(quote)
        ? { kind: "passage", number, blockId: blockId.trim(), quote, ...marked }
        : `Passage #${number} must quote some words, and no more than a passage holds.`;
    default:
      return `Reference #${number} is neither a block nor a passage.`;
  }
}

/** What was marked, read back from a body entry, or the refusal naming what
 * is wrong with it: a target the shell never sends, a proposal that does not
 * name its group and item, and a proposal or a retired block with no revision.
 * BO_0263_007 */
function readMarked(entry: Record<string, unknown>, number: unknown): MarkedTarget | string {
  const { target, group, item, revisionId } = entry;
  const named = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);
  if (target !== undefined && target !== "proposal" && target !== "retired") {
    return `Reference #${String(number)} points at neither a block, a proposal nor a retired block.`;
  }
  for (const [name, value] of [["group", group], ["item", item], ["revisionId", revisionId]] as const) {
    if (value !== undefined && named(value) === undefined) {
      return `Reference #${String(number)} carries a ${name} that names nothing.`;
    }
  }
  if (target === "proposal" && (named(group) === undefined || named(item) === undefined)) {
    return `Proposal reference #${String(number)} names no group or no item.`;
  }
  if (target !== "proposal" && (group !== undefined || item !== undefined)) {
    return `Reference #${String(number)} names a proposal but points at none.`;
  }
  if (target !== undefined && named(revisionId) === undefined) {
    return `Reference #${String(number)} names no revision of what was marked.`;
  }
  return {
    ...(target === undefined ? {} : { target }),
    ...(named(group) === undefined ? {} : { group: named(group) as string }),
    ...(named(item) === undefined ? {} : { item: named(item) as string }),
    ...(named(revisionId) === undefined ? {} : { revisionId: named(revisionId) as string }),
  };
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
 * reference or a fixated block, or a passage by its number in its block. The
 * view holds the passage's anchor, so the number is all it needs to find the
 * words. CA_0039_004
 */
export type RevealTarget =
  | { readonly kind: "block"; readonly blockId: string }
  /** A rowless reference's chip × asks the view, which alone holds the
   * marks, to take it back by its number. BO_0263_007 */
  | { readonly kind: "takeBack"; readonly number: number }
  | {
      readonly kind: "passage";
      readonly blockId: string;
      readonly number: number;
    };

export const revealTarget = (
  shown: PointedReference | FixatedBlock,
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
  // What the reference is, in words, when it is not simply a block of the
  // document, and what has happened to it since. BO_0263_007
  const what =
    reference.what === "proposal"
      ? `proposed by ${reference.proposer ?? "an agent"}, `
      : reference.what === "retired"
        ? "retired block, "
        : reference.what === "discarded"
          ? "discarded block, "
          : "";
  const since = reference.since === undefined ? "" : `, since ${reference.since}`;
  return `Reference ${reference.number}${reference.stale ? ", stale" : ""}: ${what}“${reference.words}”${since}`;
}

/** A rowless reference's ×: it has no row in the document left to press. */
export const takeBackName = (reference: PointedReference): string =>
  `Take back reference ${reference.number}`;

/** A fixated block's chip, which carries no number: a fixated block is a
 * standing, not a reference. CA_0039_003 */
export function fixatedChipName(fixated: FixatedBlock): string {
  return `Fixated: “${fixated.words}”`;
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
