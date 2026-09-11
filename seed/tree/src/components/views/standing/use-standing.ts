import {
  $,
  createContextId,
  useContext,
  useStore,
  useTask$,
  type QRL,
} from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { DONE, type Standing } from "~/lib/disposition";
import { openingWords } from "~/lib/pointing";
import { runsText } from "~/lib/runs";
import type { BlockView } from "~/server/documents/assemble";
import { describeOutcome, sendCommand } from "../documents-client";
import type { MarkingControls } from "../marking/use-marking";

/**
 * A block's standing on the disposition scale, as the block editor sets and
 * takes it back. BO_0227_011 BO_0227_012 BO_0227_013
 *
 * Every path that changes a standing — the swipe, the bar's control, the key
 * chord, a discarded block's Reopen — goes through `setStanding$`, so there
 * is one write, one undo, and one announcement however it was asked for.
 *
 * The write follows the save's rules. On the block being edited, the edit is
 * saved first and the standing is written from the editor's base, which then
 * advances; nothing under the caret is re-read, and the new standing shows
 * through `overlay` until the document is next read. On any other block, an
 * edit under way is ended first — as a press outside the block would — and
 * the document is read again. Discarding the block being edited ends the edit
 * too, since a discarded block leaves the flow.
 */

export interface StandingStore {
  /** Standings written while their block was being edited, shown until the
   * document is next read. */
  overlay: Readonly<Record<string, Standing>>;
  /** The last change, in words, for assistive technology. */
  announcement: string;
}

export interface StandingControls {
  readonly store: StandingStore;
  readonly setStanding$: QRL<(blockId: string, to: Standing) => Promise<void>>;
}

export const StandingContext = createContextId<StandingControls>(
  "block-editor.standing",
);

/** A block's standing as the surface shows it right now. */
export const standingOf = (block: BlockView, store: StandingStore): Standing =>
  block.kind === "text"
    ? (store.overlay[block.blockId] ?? block.standing)
    : "neutral";

/** What the hook reads and writes of the surface it serves. */
export interface StandingSurface {
  readonly document: { readonly blocks: readonly BlockView[] } | null;
  readonly activeBlockId: string | null;
  notice: string | null;
}

/** What the hook reads and advances of the active block's editor. */
export interface StandingEditor {
  readonly blockId: string | null;
  baseRevisionId: string;
}

/** How the reader is told what changed: the verb and the block's opening. */
const said = (standing: Standing, block: BlockView): string =>
  `${DONE[standing]} “${block.kind === "text" ? openingWords(runsText(block.runs)) : ""}”`;

export function useStanding(input: {
  readonly documentId: string | null;
  readonly surface: StandingSurface;
  readonly editor: StandingEditor;
  readonly marking: MarkingControls;
  readonly save$: QRL<(keepalive?: boolean) => Promise<boolean>>;
  readonly deactivate$: QRL<() => Promise<void>>;
  readonly reload$: QRL<() => Promise<void>>;
}): StandingControls {
  const { documentId, surface, editor, marking, save$, deactivate$, reload$ } =
    input;
  const bridge = useContext(ViewBridgeContext);
  const store = useStore<StandingStore>({ overlay: {}, announcement: "" });

  /** A read of the document is the graph's word on every standing, so what
   * was shown in its place gives way to it. */
  useTask$(({ track }) => {
    track(() => surface.document);
    if (Object.keys(store.overlay).length > 0) store.overlay = {};
  });

  /** Writes one standing; answers whether it landed. A refusal is said on the
   * surface's notice, as a refused structural command is. */
  const write$ = $(async (blockId: string, to: Standing): Promise<boolean> => {
    if (documentId === null) return false;
    const editing = surface.activeBlockId === blockId && to !== "discarded";
    if (editing) {
      if (!(await save$())) return false;
    } else if (surface.activeBlockId !== null) {
      await deactivate$();
    }
    const base = editing
      ? editor.baseRevisionId
      : surface.document?.blocks.find((block) => block.blockId === blockId)
          ?.revisionId;
    if (base === undefined) return false;
    const outcome = await sendCommand(documentId, {
      command: "setDisposition",
      blockId,
      baseRevisionId: base,
      standing: to,
    });
    if (outcome.outcome !== "success") {
      surface.notice = describeOutcome(outcome);
      return false;
    }
    surface.notice = null;
    if (editing) {
      editor.baseRevisionId = outcome.result.revisionId;
      store.overlay = { ...store.overlay, [blockId]: to };
    } else {
      await reload$();
    }
    return true;
  });

  /**
   * Sets a standing and offers to take it back. The inverse writes the
   * previous value — a named action in the dock, never the undo keystroke
   * (`block-editor.md`, *Undo*) — and puts back any marks a discard dropped.
   */
  const setStanding$ = $(async (blockId: string, to: Standing) => {
    const block = surface.document?.blocks.find(
      (candidate) => candidate.blockId === blockId,
    );
    if (block === undefined || block.kind !== "text") return;
    const from = standingOf(block, store);
    if (from === to) return;
    // A discarded block is not markable, so discarding one takes its marks
    // with it; they are kept here so the undo can put them back.
    const dropped =
      to === "discarded"
        ? marking.store.marking.references.filter(
            (reference) => reference.blockId === blockId,
          )
        : [];
    if (!(await write$(blockId, to))) return;
    const words = said(to, block);
    store.announcement = words;
    await bridge.offerUndo$({
      label: words,
      undo$: $(async () => {
        if (!(await write$(blockId, from))) return;
        await marking.restore$(dropped);
        store.announcement = said(from, block);
      }),
    });
  });

  return { store, setStanding$ };
}
