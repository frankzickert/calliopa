import {
  $,
  createContextId,
  useContext,
  useStore,
  useTask$,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import { ViewBridgeContext, type ViewPointing } from "~/components/shell/view-bridge";
import { NO_POINTING, type Pointing } from "~/lib/command-target";
import type { PassageAnchor } from "~/lib/passage";
import { openingWords, pointingOf, type OpenItem, type PointableBlock } from "../../lib/pointing";
import {
  addPassage,
  documentsMarked,
  followDocument,
  legacyMarkingKey,
  localizeMarking,
  markingFromSent,
  markingKey,
  NO_MARKING,
  parseMarking,
  removeReference,
  repointPassage,
  serializeMarking,
  toggleDocument,
  toggleReference,
  type Marked,
  type Marking,
} from "../../lib/references";
import { runsText } from "~/lib/runs";
import type { BlockView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";

/**
 * Command mode's marking session: the prompt block the marks belong to, the
 * mode the surface is in while it points from it, and what the reader has
 * marked from it (`command-mode.md`, `CA_0020_004`, `BO_0267_013`).
 *
 * Its own module so the block editor composes it rather than holding it: the
 * record, its recovery and persistence and the report to the shell all live
 * here, and a row reads what it needs from `MarkingContext` rather than being
 * handed it as props. BO_0227_006
 */
export interface MarkingStore {
  marking: Marking;
  /** The block the marks belong to: the block being edited, or the one
   * pointed from. BO_0267_013 */
  prompt: string | null;
  /** Each prompt's marks as the page last held them, so a block's marks
   * come back on this page whether or not the browser keeps anything.
   * BO_0267_013 */
  byPrompt: Record<string, Marking>;
  /** What the marks are reported as — their words, whether a passage still
   * matches, and the pinned blocks — which the block's command control shows
   * as chips. BO_0267_012 */
  report: Pointing;
  /** Whether this view is a guest of another document's pointing
   * (`BO_0304_008`): the session names another document, and `marking` here
   * mirrors the session's marks that point into this one. A guest keeps no
   * record and makes no report; its marks go to the session. */
  guest: boolean;
  /** The prompt this view had before it became a guest, brought back when
   * the pointing ends. */
  ownPrompt: string | null;
}

export interface MarkingControls {
  readonly store: MarkingStore;
  /** Points from a prompt block, or with null ends pointing. The prompt
   * stays edited. BO_0267_013 BO_0267_023 */
  readonly point$: QRL<(prompt: string | null) => Promise<void>>;
  /** Makes a block the prompt the marks belong to, as it becomes the one
   * being edited, bringing its marks back. BO_0267_013 */
  readonly selectPrompt$: QRL<(blockId: string) => Promise<void>>;
  /** Marks a row as a reference, or takes the mark back: a block of the
   * document, or what `marked` names — a proposal, a retired block. BO_0263_005 */
  readonly toggleReference$: QRL<(blockId: string, marked?: Marked) => void>;
  /** Marks words inside a row as a passage. BO_0227_009 */
  readonly addPassage$: QRL<(blockId: string, anchor: PassageAnchor, marked?: Marked) => void>;
  /** Points a stale passage at new words, keeping its number. */
  readonly repointPassage$: QRL<
    (number: number, anchor: PassageAnchor) => void
  >;
  /** Takes one reference back by its number. */
  readonly removeReference$: QRL<(number: number) => void>;
  /** Drops the record a document kept before marks belonged to a block.
   * Called before the document is read. BO_0267_013 */
  readonly recover$: QRL<() => void>;
}

export const MarkingContext = createContextId<MarkingControls>(
  "block-editor.marking",
);

/** What the hook reads of the surface it serves. */
export interface MarkingSurface {
  readonly status: "loading" | "ready" | "failed";
  readonly document: { readonly blocks: readonly BlockView[]; readonly title?: string } | null;
  /** The proposals standing against the document, null until read: what a
   * proposal reference follows once it is answered. BO_0263_004 */
  readonly proposals: DocumentProposals | null;
}

/** The text blocks a report reads, in reading order. */
function pointable(blocks: readonly BlockView[]): PointableBlock[] {
  return blocks.flatMap((block) =>
    block.kind === "text"
      ? [
          {
            blockId: block.blockId,
            text: runsText(block.runs),
            standing: block.standing,
          },
        ]
      : [],
  );
}

/** The open proposal items by id, as a report names them. */
function openItems(proposals: DocumentProposals | null): ReadonlyMap<string, OpenItem> | null {
  if (proposals === null) return null;
  const items = new Map<string, OpenItem>();
  for (const group of proposals.groups) {
    for (const item of group.items) {
      items.set(item.itemId, { words: item.block !== null && item.block.kind === "text" ? runsText(item.block.runs) : "" });
    }
  }
  return items;
}

/**
 * What a mark on a block of the document keeps of it: the revision the reader
 * saw, its opening words for when its row has gone, and whether it was
 * discarded. A proposal's or a retired block's row says its own. BO_0263_004
 */
function asMarked(surface: MarkingSurface, blockId: string, marked: Marked): Marked {
  if (marked.target !== undefined || marked.revisionId !== undefined) return marked;
  const block = surface.document?.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined) return marked;
  return {
    ...marked,
    revisionId: block.revisionId,
    ...(block.kind === "text" ? { words: openingWords(runsText(block.runs)) } : {}),
    ...(block.kind === "text" && block.standing === "discarded" ? { discarded: true } : {}),
  };
}

/** A browser that keeps nothing is a browser this document was never marked
 * in, and one whose storage throws keeps nothing: both read as no session. */
function storedMarking(documentId: string, prompt: string): Marking | null {
  try {
    const raw = window.localStorage.getItem(markingKey(documentId, prompt));
    return raw === null ? null : parseMarking(raw);
  } catch {
    return null;
  }
}

/** A prompt's marks as its latest run the person may see carried them, or
 * nothing marked. BO_0267_013 */
async function sentMarking(documentId: string, prompt: string): Promise<Marking> {
  try {
    const response = await fetch(`/api/runs?artifact=${encodeURIComponent(documentId)}`);
    if (!response.ok) return NO_MARKING;
    const body = (await response.json()) as { runs?: { source: string | null; references?: Parameters<typeof markingFromSent>[0] }[] };
    const latest = (body.runs ?? []).find((run) => run.source === prompt);
    return latest?.references === undefined ? NO_MARKING : markingFromSent(latest.references);
  } catch {
    return NO_MARKING;
  }
}

/** Writes the session back, or clears it when there is nothing to keep. A
 * browser that keeps nothing loses the marks at the page's end; the document
 * is untouched either way, so there is nothing to recover or report. */
function keepMarking(documentId: string, prompt: string, marking: Marking): void {
  try {
    const kept = serializeMarking(marking);
    if (kept === null) window.localStorage.removeItem(markingKey(documentId, prompt));
    else window.localStorage.setItem(markingKey(documentId, prompt), kept);
  } catch {
    // Nothing to do: see above.
  }
}

/**
 * Writes the pointing session (`BO_0304_008`): the marks as the record keeps
 * them, the documents marked whole, and the prompt's own record on the
 * device, so what the prompt's view reads back when it mounts again — from
 * the session while the pointing stands, from the device after — is what was
 * marked wherever it was marked. Module-level, as every helper a `$` closure
 * reaches must be: a function captured from the component's scope cannot be
 * serialized.
 */
function writeSession(session: ViewPointing, marking: Marking): void {
  if (session.documentId === null || session.prompt === null) return;
  session.marks = serializeMarking(marking) ?? "";
  session.documents = documentsMarked(marking);
  session.seq += 1;
  keepMarking(session.documentId, session.prompt, marking);
}

/** The session's marks, whole — every document's — as a guest applies a
 * change to them. */
const sessionMarking = (session: ViewPointing): Marking => parseMarking(session.marks === "" ? null : session.marks);

/** Whether a view points, or is pointed for: the session names its document. */
const owns = (session: ViewPointing, documentId: string | null): boolean => documentId !== null && session.documentId === documentId;

/** What a mark made in a guest view carries: which document it points into,
 * and what the reader saw it called. BO_0304_008 */
const fromHere = (surface: MarkingSurface, documentId: string | null, marked: Marked): Marked => ({
  ...marked,
  ...(documentId === null ? {} : { document: documentId }),
  ...(surface.document?.title === undefined || surface.document.title === "" ? {} : { documentTitle: surface.document.title }),
});

export function useMarking(input: {
  readonly documentId: string | null;
  readonly surface: MarkingSurface;
  /** Accepts a derived rewrite of a block as the block is referenced: the
   * mark is made at once, the acceptance follows. BO_0246_006 */
  readonly beforeReference$?: QRL<(blockId: string) => Promise<boolean>>;
}): MarkingControls {
  const { documentId, surface, beforeReference$ } = input;
  const bridge = useContext(ViewBridgeContext);
  const store = useStore<MarkingStore>({ marking: NO_MARKING, prompt: null, byPrompt: {}, report: NO_POINTING, guest: false, ownPrompt: null });
  const session = bridge.pointing;

  /**
   * Makes a block the prompt: its marks come back from the device, or from
   * the latest run sent from it when the device holds none. BO_0267_013
   * A guest keeps its own prompt aside: the marks it draws are the
   * session's, and the block comes back as its prompt when the pointing
   * ends. BO_0304_008
   */
  const selectPrompt$ = $(async (blockId: string) => {
    if (documentId === null) return;
    if (store.guest) {
      store.ownPrompt = blockId;
      return;
    }
    if (store.prompt === blockId) return;
    if (store.prompt !== null) store.byPrompt = { ...store.byPrompt, [store.prompt]: store.marking };
    store.prompt = blockId;
    const held = store.byPrompt[blockId] ?? storedMarking(documentId, blockId);
    // The marks come back; the mode stays what the surface is in.
    store.marking = { ...(held ?? NO_MARKING), mode: store.marking.mode };
    // Pointing follows the prompt: editing another block while pointing
    // makes it the prompt, and the session says so. BO_0304_008
    if (store.marking.mode === "command" && owns(session, documentId)) {
      session.prompt = blockId;
      writeSession(session, store.marking);
    }
    if (held !== null) return;
    const sent = await sentMarking(documentId, blockId);
    // A later choice of prompt, or a mark made meanwhile, wins over the read.
    if (store.prompt === blockId && store.marking.references.length === 0) {
      store.marking = { ...sent, mode: store.marking.mode };
    }
  });

  /** Brings this view's own marks back once another document's pointing
   * ends: its prompt, if it had one, with that prompt's marks. BO_0304_008 */
  const leaveGuest$ = $(async () => {
    if (!store.guest) return;
    store.guest = false;
    const prompt = store.ownPrompt;
    store.ownPrompt = null;
    store.prompt = null;
    store.marking = NO_MARKING;
    if (prompt !== null) await selectPrompt$(prompt);
  });

  /**
   * One place decides what the mode is, and the blocks read it. Pointing
   * starts from a prompt block, which stays edited while other rows are
   * marked; leaving preserves what was marked, so closing the mode by
   * accident costs nothing: only the mode changes. BO_0267_013 BO_0267_023
   *
   * Pointing is one across the workspace (`BO_0304_008`): starting it writes
   * the session, which replaces whichever prompt was pointing, and ending it
   * — from the prompt's own view or from a guest — clears the session, so
   * every view reads as the reading surface it was.
   */
  const point$ = $(async (prompt: string | null) => {
    if (prompt === null) {
      if (store.guest || owns(session, documentId)) {
        session.documentId = null;
        session.prompt = null;
        session.marks = "";
        session.documents = [];
        session.seq += 1;
      }
      if (store.marking.mode === "reading") return;
      store.marking = { ...store.marking, mode: "reading" };
      return;
    }
    if (documentId === null) return;
    // A guest that starts pointing from its own block ends its guesting
    // first, so its own marks come back before they are pointed from.
    if (store.guest) await leaveGuest$();
    await selectPrompt$(prompt);
    if (store.marking.mode !== "command") store.marking = { ...store.marking, mode: "command" };
    session.documentId = documentId;
    session.prompt = prompt;
    writeSession(session, store.marking);
  });

  /**
   * Marking is not activation: it opens no editor, writes no revision, and
   * leaves the document exactly as it was. Numbers are assigned in the order
   * the reader marked, so `#2`, `#1`, `#3` down the page says both which
   * blocks were marked and in what order. A guest's mark goes to the
   * session, for the prompt that is pointing. BO_0304_008
   */
  const toggleReference$ = $((blockId: string, marked: Marked = {}) => {
    const held = store.guest ? sessionMarking(session) : store.marking;
    const before = held.references.length;
    const next = toggleReference(held, blockId, store.guest ? fromHere(surface, documentId, asMarked(surface, blockId, marked)) : asMarked(surface, blockId, marked));
    if (store.guest) {
      writeSession(session, next);
      if (documentId !== null) store.marking = localizeMarking(next, documentId);
    } else {
      store.marking = next;
    }
    // Referencing a block that carries a derived rewrite accepts the rewrite
    // on the way; the mark itself is made at once, as it always was.
    const added = next.references.length > before;
    if (added && marked.target === undefined && beforeReference$ !== undefined) void beforeReference$(blockId);
  });

  const addPassage$ = $((blockId: string, anchor: PassageAnchor, marked: Marked = {}) => {
    if (store.guest) {
      const next = addPassage(sessionMarking(session), blockId, anchor, fromHere(surface, documentId, asMarked(surface, blockId, marked)));
      writeSession(session, next);
      if (documentId !== null) store.marking = localizeMarking(next, documentId);
      return;
    }
    store.marking = addPassage(store.marking, blockId, anchor, asMarked(surface, blockId, marked));
  });

  const repointPassage$ = $((number: number, anchor: PassageAnchor) => {
    if (store.guest) {
      const next = repointPassage(sessionMarking(session), number, anchor);
      writeSession(session, next);
      if (documentId !== null) store.marking = localizeMarking(next, documentId);
      return;
    }
    store.marking = repointPassage(store.marking, number, anchor);
  });

  const removeReference$ = $((number: number) => {
    if (store.guest) {
      const next = removeReference(sessionMarking(session), number);
      writeSession(session, next);
      if (documentId !== null) store.marking = localizeMarking(next, documentId);
      return;
    }
    store.marking = removeReference(store.marking, number);
  });

  /**
   * The session, as this view reads it (`BO_0304_008`). Named for another
   * document, this view is its guest: it draws the session's marks that
   * point into this document as its own, in command mode, and its own marks
   * wait. Named for this document while this view holds no pointing — the
   * prompt's view mounting again after the reader was elsewhere — the marks
   * come from the session, whatever the device holds. Named for nothing, a
   * guest goes back to its own.
   */
  useTask$(async ({ track }) => {
    const named = track(() => session.documentId);
    const prompt = track(() => session.prompt);
    // Not the session's count: the view that writes the session — the owner
    // on every mark, a guest on its own — already holds what it wrote, and a
    // task woken by its own write would only delay the row's next paint.
    if (documentId === null) return;
    if (named !== null && named !== documentId) {
      if (!store.guest) {
        store.ownPrompt = store.prompt;
        if (store.prompt !== null) store.byPrompt = { ...store.byPrompt, [store.prompt]: { ...store.marking, mode: "reading" } };
        store.guest = true;
        store.prompt = null;
      }
      store.marking = localizeMarking(sessionMarking(session), documentId);
      return;
    }
    if (store.guest) {
      await leaveGuest$();
      return;
    }
    if (named === documentId && prompt !== null && store.marking.mode !== "command") {
      // Pointing again from the prompt the session names, its marks the
      // session's.
      if (store.prompt !== null && store.prompt !== prompt) store.byPrompt = { ...store.byPrompt, [store.prompt]: store.marking };
      store.prompt = prompt;
      store.marking = { ...sessionMarking(session), mode: "command" };
    }
  });

  /**
   * The shell's *Mark document* (`BO_0304_008`): pressed on a library row or
   * a tab while a pointing stands, applied here by whichever document view
   * is mounted — the prompt's own, or a guest — to the session's marks, and
   * cleared once applied so the next press is told from this one.
   */
  useTask$(({ track }) => {
    track(() => bridge.across.seq);
    const document = bridge.across.document;
    if (document === null || documentId === null) return;
    if (!store.guest && !owns(session, documentId)) return;
    bridge.across.document = null;
    if (store.guest) {
      const next = toggleDocument(sessionMarking(session), document, bridge.across.title);
      writeSession(session, next);
      if (documentId !== null) store.marking = localizeMarking(next, documentId);
      return;
    }
    store.marking = toggleDocument(store.marking, document, bridge.across.title);
  });

  const recover$ = $(() => {
    if (documentId === null) return;
    try {
      window.localStorage.removeItem(legacyMarkingKey(documentId));
    } catch {
      // A browser that keeps nothing kept no record either.
    }
  });

  /**
   * A reference is what was marked, and is kept when its row goes: its chip
   * is where it is then taken back. A proposal accepted since moves its
   * number to the block it became. Re-derived whenever the document, its
   * proposals or the marks change, rather than done by whichever read
   * happened to notice. BO_0263_004
   */
  useTask$(({ track }) => {
    const document = track(() => surface.document);
    const proposals = track(() => surface.proposals);
    track(() => store.marking);
    // A guest's marks are the session's: what this document says of them is
    // said where they are applied. BO_0304_008
    if (document === null || store.guest) return;
    const items = openItems(proposals);
    const kept = followDocument(store.marking, {
      blocks: document.blocks,
      openItems: items === null ? null : new Set(items.keys()),
    });
    // `followDocument` answers the same session when nothing changed, and
    // only a change is written, so this task does not wake itself.
    if (kept !== store.marking) store.marking = kept;
  });

  /**
   * Keeps the session, device-locally and per prompt block — never graph truth,
   * and not the workspace record, which follows the reader to another device.
   * Not before the document is ready: the session is restored on the way in,
   * and a write from the state this view starts in would clear it.
   */
  useVisibleTask$(({ track }) => {
    const marking = track(() => store.marking);
    const prompt = track(() => store.prompt);
    const status = track(() => surface.status);
    if (documentId === null || prompt === null || status !== "ready" || store.guest) return;
    keepMarking(documentId, prompt, marking);
    // While pointing, the session carries the marks across tabs: every
    // change of them is written there too. BO_0304_008
    if (marking.mode === "command" && owns(session, documentId) && session.prompt === prompt) writeSession(session, marking);
  });

  /**
   * Tells the shell what the reader is pointing at from the prompt block, so
   * the command sent from it carries it: the marks with their words and whether a passage
   * still matches, and the pinned blocks. After the document is ready, as the
   * record is kept, and again whenever the document is read, since a save can
   * make a passage stale or a standing change what is pinned.
   * BO_0226_006 BO_0227_015
   */
  useVisibleTask$(({ track }) => {
    const marking = track(() => store.marking);
    const document = track(() => surface.document);
    const status = track(() => surface.status);
    const proposals = track(() => surface.proposals);
    // A guest reports nothing: the marks it draws are another prompt's, and
    // the report it last made for its own stands. BO_0304_008
    if (documentId === null || status !== "ready" || document === null || store.guest) return;
    store.report = pointingOf(marking, pointable(document.blocks), openItems(proposals));
    void bridge.setPointing$(documentId, store.report);
  });

  return {
    store,
    point$,
    selectPrompt$,
    toggleReference$,
    addPassage$,
    repointPassage$,
    removeReference$,
    recover$,
  };
}
