import {
  $,
  createContextId,
  useContext,
  useStore,
  useTask$,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { PassageAnchor } from "~/lib/passage";
import { pointingOf, type PointableBlock } from "~/lib/pointing";
import {
  addPassage,
  keepPresent,
  markingKey,
  NO_MARKING,
  parseMarking,
  removeReference,
  repointPassage,
  restoreReferences,
  serializeMarking,
  toggleReference,
  type EditorMode,
  type Marking,
  type Reference,
} from "~/lib/references";
import { runsText } from "~/lib/runs";
import type { BlockView } from "~/server/documents/assemble";

/**
 * Command mode's marking session for one document: the mode the surface is
 * in and what the reader has marked, kept together because they come back
 * together (`command-mode.md`, `CA_0020_004`).
 *
 * Its own module so the block editor composes it rather than holding it: the
 * record, its recovery and persistence, the report to the shell and the dock's
 * toggle all live here, and a row reads what it needs from `MarkingContext`
 * rather than being handed it as props. BO_0227_006
 */
export interface MarkingStore {
  marking: Marking;
}

export interface MarkingControls {
  readonly store: MarkingStore;
  /** Enters or leaves command mode. Entering ends any edit first. */
  readonly setMode$: QRL<(on: boolean) => Promise<void>>;
  /** Marks a block as a reference, or takes the mark back. */
  readonly toggleReference$: QRL<(blockId: string) => void>;
  /** Marks words inside a block as a passage. BO_0227_009 */
  readonly addPassage$: QRL<(blockId: string, anchor: PassageAnchor) => void>;
  /** Points a stale passage at new words, keeping its number. */
  readonly repointPassage$: QRL<
    (number: number, anchor: PassageAnchor) => void
  >;
  /** Takes one reference back by its number. */
  readonly removeReference$: QRL<(number: number) => void>;
  /** Puts back references a change took with it, under their numbers. */
  readonly restore$: QRL<(references: readonly Reference[]) => void>;
  /** Reads the stored session back. Called before the document is read, so
   * the read that follows is what drops references to departed blocks. */
  readonly recover$: QRL<() => void>;
}

export const MarkingContext = createContextId<MarkingControls>(
  "block-editor.marking",
);

/** What the hook reads of the surface it serves. */
export interface MarkingSurface {
  readonly status: "loading" | "ready" | "failed";
  readonly document: { readonly blocks: readonly BlockView[] } | null;
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

/** The blocks a reference may point into: every block the flow draws. A
 * discarded block is set aside, so it is not markable, and discarding a
 * marked block takes its references with it. */
function markable(blocks: readonly BlockView[]): string[] {
  return blocks
    .filter((block) => block.kind !== "text" || block.standing !== "discarded")
    .map((block) => block.blockId);
}

/** A browser that keeps nothing is a browser this document was never marked
 * in, and one whose storage throws keeps nothing: both read as no session. */
function storedMarking(documentId: string): Marking {
  try {
    return parseMarking(window.localStorage.getItem(markingKey(documentId)));
  } catch {
    return NO_MARKING;
  }
}

/** Writes the session back, or clears it when there is nothing to keep. A
 * browser that keeps nothing loses the marks at the page's end; the document
 * is untouched either way, so there is nothing to recover or report. */
function keepMarking(documentId: string, marking: Marking): void {
  try {
    const kept = serializeMarking(marking);
    if (kept === null) window.localStorage.removeItem(markingKey(documentId));
    else window.localStorage.setItem(markingKey(documentId), kept);
  } catch {
    // Nothing to do: see above.
  }
}

export function useMarking(input: {
  readonly documentId: string | null;
  readonly surface: MarkingSurface;
  /** The flush that runs when a block is left. Entering command mode owns the
   * commit rather than inheriting it from a click that landed elsewhere. */
  readonly leaveEditing$: QRL<() => Promise<void>>;
}): MarkingControls {
  const { documentId, surface, leaveEditing$ } = input;
  const bridge = useContext(ViewBridgeContext);
  const store = useStore<MarkingStore>({ marking: NO_MARKING });

  /**
   * One place decides what the mode is, and the blocks read it. Leaving
   * preserves what was marked, so closing the mode by accident costs nothing:
   * only the mode changes.
   */
  const setMode$ = $(async (on: boolean) => {
    const next: EditorMode = on ? "command" : "reading";
    if (store.marking.mode === next) return;
    if (next === "command") await leaveEditing$();
    store.marking = { ...store.marking, mode: next };
  });

  /**
   * Marking is not activation: it opens no editor, writes no revision, and
   * leaves the document exactly as it was. Numbers are assigned in the order
   * the reader marked, so `#2`, `#1`, `#3` down the page says both which
   * blocks were marked and in what order.
   */
  const toggleReference$ = $((blockId: string) => {
    store.marking = toggleReference(store.marking, blockId);
  });

  const addPassage$ = $((blockId: string, anchor: PassageAnchor) => {
    store.marking = addPassage(store.marking, blockId, anchor);
  });

  const repointPassage$ = $((number: number, anchor: PassageAnchor) => {
    store.marking = repointPassage(store.marking, number, anchor);
  });

  const removeReference$ = $((number: number) => {
    store.marking = removeReference(store.marking, number);
  });

  const restore$ = $((references: readonly Reference[]) => {
    store.marking = restoreReferences(store.marking, references);
  });

  const recover$ = $(() => {
    if (documentId !== null) store.marking = storedMarking(documentId);
  });

  /**
   * A mark on nothing cannot be drawn, and the document is the only list
   * there is, so a reference whose block has left the document is dropped
   * rather than kept somewhere it could not appear. Re-derived whenever the
   * document or the marks change, rather than done by whichever read happened
   * to notice.
   */
  useTask$(({ track }) => {
    const document = track(() => surface.document);
    track(() => store.marking);
    if (document === null) return;
    const kept = keepPresent(store.marking, markable(document.blocks));
    // `keepPresent` answers the same session when nothing was dropped, and
    // only a change is written, so this task does not wake itself.
    if (kept !== store.marking) store.marking = kept;
  });

  /**
   * Keeps the session, device-locally and per document — never graph truth,
   * and not the workspace record, which follows the reader to another device.
   * Not before the document is ready: the session is restored on the way in,
   * and a write from the state this view starts in would clear it.
   */
  useVisibleTask$(({ track }) => {
    const marking = track(() => store.marking);
    const status = track(() => surface.status);
    if (documentId === null || status !== "ready") return;
    keepMarking(documentId, marking);
  });

  /**
   * Tells the shell what the reader is pointing at, so a command from the
   * composer can carry it: the marks with their words and whether a passage
   * still matches, and the pinned blocks. After the document is ready, as the
   * record is kept, and again whenever the document is read, since a save can
   * make a passage stale or a standing change what is pinned.
   * BO_0226_006 BO_0227_015
   */
  useVisibleTask$(({ track }) => {
    const marking = track(() => store.marking);
    const document = track(() => surface.document);
    const status = track(() => surface.status);
    if (documentId === null || status !== "ready" || document === null) return;
    void bridge.setPointing$(
      documentId,
      pointingOf(marking, pointable(document.blocks)),
    );
  });

  /**
   * The way into command mode, contributed to the command dock. A toggle, so
   * the control says which mode the surface is in rather than only offering a
   * way in. Written from a task so the document's own render stays out of it,
   * and the shell re-renders the dock action alone.
   */
  useTask$(({ track }) => {
    const status = track(() => surface.status);
    const mode = track(() => store.marking.mode);
    if (status !== "ready") {
      bridge.dock.action = null;
      return;
    }
    bridge.dock.action = {
      kind: "toggle",
      id: "command-mode",
      label: "Command mode",
      on: mode === "command",
      run$: setMode$,
    };
  });

  return {
    store,
    setMode$,
    toggleReference$,
    addPassage$,
    repointPassage$,
    removeReference$,
    restore$,
    recover$,
  };
}
