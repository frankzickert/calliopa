import {
  $,
  createContextId,
  useStore,
  useTask$,
  type QRL,
} from "@builder.io/qwik";

import { DONE, type Standing } from "../../lib/disposition";
import { openingWords } from "../../lib/pointing";
import { runsText } from "~/lib/runs";
import type { BlockView } from "../../server/assemble";
import { afterFloor, describeOutcome, refusedByFloor, sendCommand } from "../documents-client";
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
  /**
   * The last saved change of standing, and what taking it back writes: the
   * block, the standing it had, what the change said and what taking it back
   * says. The bar's trailing group offers it as a control of its own — the
   * separately named action a saved structural operation is reversed by,
   * never the undo keystroke. CA_0058_011
   */
  takeBack: {
    readonly blockId: string;
    readonly to: Standing;
    /** What the change said, which is what the control offers to take back. */
    readonly did: string;
    /** What taking it back says. */
    readonly said: string;
  } | null;
}

export interface StandingControls {
  readonly store: StandingStore;
  readonly setStanding$: QRL<(blockId: string, to: Standing) => Promise<void>>;
  /** Writes the previous standing of the last change and clears the offer. */
  readonly takeBack$: QRL<() => Promise<void>>;
}

export const StandingContext = createContextId<StandingControls>(
  "block-editor.standing",
);

/** A block's standing as the surface shows it right now. */
export const standingOf = (block: BlockView, store: StandingStore): Standing =>
  block.kind === "text"
    ? (store.overlay[block.blockId] ?? block.standing)
    : "keep";

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
  /** Answers a derived candidate by use before its standing is written: a
   * pin or a keep accepts it first, a discard rejects it and writes no
   * standing. `proceed` writes, `skip` counts as done, `stop` failed.
   * BO_0246_006 */
  readonly beforeStanding$?: QRL<(blockId: string, to: Standing) => Promise<"proceed" | "skip" | "stop">>;
  /** Runs after a standing the reader set has landed and the document was
   * read back — the reader's own act, which is never news to them. BO_0246_007 */
  readonly afterStanding$?: QRL<() => Promise<void>>;
}): StandingControls {
  const { documentId, surface, editor, save$, deactivate$, reload$, beforeStanding$, afterStanding$ } =
    input;
  const store = useStore<StandingStore>({ overlay: {}, announcement: "", takeBack: null });

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
    if (beforeStanding$ !== undefined) {
      const verdict = await beforeStanding$(blockId, to);
      if (verdict === "stop") return false;
      if (verdict === "skip") return true;
    }
    // A discarded block and a prompt leave the flow, so editing either ends.
    // BO_0267_014
    const editing = surface.activeBlockId === blockId && to !== "discarded" && to !== "prompt";
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
    const standing = { command: "setDisposition", blockId, baseRevisionId: base, standing: to };
    let outcome = await sendCommand(documentId, standing);
    // A standing written in the breath after the block's own save — a send
    // by `Ctrl`/`Cmd`+`Enter` on a block just typed into — lands inside the
    // kernel's per-node floor; the write was sound, so it goes again after
    // the floor. DO_0015_003
    if (refusedByFloor(outcome)) {
      await afterFloor();
      outcome = await sendCommand(documentId, standing);
    }
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
      if (afterStanding$ !== undefined) await afterStanding$();
    }
    return true;
  });

  /**
   * Sets a standing and records what taking it back would write. The inverse
   * writes the previous value — a control of its own in the bar's *History*
   * group, never the undo keystroke (`block-editor.md`, *Undo*). A discard
   * keeps the block's marks: a reference is what was marked, and a discarded
   * block is markable. BO_0263_005 CA_0058_011
   */
  const setStanding$ = $(async (blockId: string, to: Standing) => {
    const block = surface.document?.blocks.find(
      (candidate) => candidate.blockId === blockId,
    );
    if (block === undefined || block.kind !== "text") return;
    const from = standingOf(block, store);
    if (from === to) return;
    if (!(await write$(blockId, to))) return;
    store.announcement = said(to, block);
    store.takeBack = { blockId, to: from, did: said(to, block), said: said(from, block) };
  });

  /** Takes the last change of standing back, writing the previous value. */
  const takeBack$ = $(async () => {
    const offer = store.takeBack;
    if (offer === null) return;
    store.takeBack = null;
    if (!(await write$(offer.blockId, offer.to))) return;
    store.announcement = offer.said;
  });

  return { store, setStanding$, takeBack$ };
}
