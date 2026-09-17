import { createContextId, type QRL } from "@builder.io/qwik";

import type { Tab } from "~/lib/tabs";
import type { DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";

/**
 * What the block editor offers an extension drawing on its blocks
 * (`BO_0256_007`).
 *
 * A decoration is contributed through `src/contract.ts`, which types the slot
 * and nothing else: the contract is the host's and cannot name a document.
 * The richer surface travels here instead, through a context this extension
 * exports and a decorating extension imports under its declared dependency —
 * the way `calliopa-show` imports `publishing`'s server modules
 * (`contribution-contract.md`, `CS_0001_005`).
 *
 * It is deliberately narrow: what the editor knows and a decoration cannot
 * read for itself. Everything a decoration is about — kinds, claims,
 * relations, judgements, phases — it reads through its own API, because that
 * content is not this extension's.
 */
export interface EditorSurface {
  readonly documentId: string | null;
  /** The document as the editor last read it, blocks in reading order. */
  readonly document: DocumentView | null;
  /** The block the reader is editing, and the one they focused. */
  readonly activeBlockId: string | null;
  readonly focusedBlockId: string | null;
  /** The tab the editor is mounted in, for a decoration that pushes a route. */
  readonly tab: Tab;
  /** The proposals staged against the document, as the editor read them: a
   * decoration filters its own out of them and reads what a branch holds. */
  readonly proposals: DocumentProposals | null;
  /** How many times the document has been read, so a decoration's own caches
   * know when they are older than what the reader sees. */
  readonly loaded: number;
  /** How far this person has read the document, as a data revision: a
   * reading fact the editor keeps, which a decoration interprets — what a
   * derived block said when they last looked. BO_0246_007 */
  readonly readMark: number | null;
  /** A refusal in words, shown where the editor shows its own. */
  notice: string | null;
  /** Focuses a block, as a press on it would. */
  readonly focus$: QRL<(blockId: string) => Promise<void>>;
  /** Reads the document again, after a write a decoration made. */
  readonly reload$: QRL<() => Promise<void>>;
  /** Reads the staged proposals again. */
  readonly reloadProposals$: QRL<() => Promise<void>>;
  /**
   * Ends an edit under way, as a press outside the block would. A decoration
   * that changes the scope the editor writes in calls this first: a block
   * kept active across the change keeps the other scope's revision as its
   * base, and its next save is refused as a conflict. Found live in the
   * `BO_0250` walk-through.
   */
  readonly deactivate$: QRL<() => Promise<void>>;
  /** Answers one staged item, for a decoration whose card accepts or rejects.
   * `overDrift` accepts a member whose base has moved, which reconciliation
   * asks for and an ordinary answer never does. */
  readonly answerProposal$: QRL<(itemId: string, answer: "accepted" | "rejected", overDrift?: boolean) => Promise<void>>;
  /** Sets a block's standing, the one write every standing path goes through
   * — the swipe, the bar's control, the chord and a decoration's *Pin this
   * framing* alike (`BO_0227_011`). Standing is this extension's: the
   * disposition is its declared property. */
  readonly setStanding$: QRL<(blockId: string, to: string) => Promise<void>>;
  /** Marks a block as a reference in command mode, and says whether it
   * already is one, for a decoration that hands the composer a block. */
  readonly toggleReference$: QRL<(blockId: string) => Promise<void>>;
  readonly isReference$: QRL<(blockId: string) => boolean>;
  /** Brings a block into view, for a decoration that navigates to one. */
  readonly reveal$: QRL<(blockId: string) => Promise<void>>;
}

export const EditorSurfaceContext = createContextId<EditorSurface>(
  "documents.editor-surface",
);
