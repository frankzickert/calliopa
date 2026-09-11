import type { IconName } from "./icons";
import { createContextId, type QRL } from "@builder.io/qwik";
import type { TabKind } from "~/lib/tabs";
import type { DragOperation, DragPayload } from "~/lib/drag";
import type { Pointing, RevealTarget } from "~/lib/command-target";

/**
 * What a view may reach in the shell, and nothing more.
 *
 * A view never owns a shell surface. It contributes to the inspector and to the
 * command dock, it asks the shell to record its selection, and it uses the
 * shell's drag model rather than starting a drag of its own. Each of those is
 * one field here, so the whole of a view's reach into the shell is readable in
 * one place.
 */

/** A completed drag the shell did not consume itself, handed to whichever view
 * declared the target it landed on. `seq` rises on every drop, so a view can
 * tell a repeated drop onto the same target from the previous one. */
export interface ViewDrop {
  readonly payload: DragPayload;
  readonly operation: DragOperation;
  readonly overId: string;
  readonly seq: number;
}

export interface ViewDragState {
  /** The target under the pointer, so a view can show its own drop indicator. */
  readonly overId: string | null;
  readonly drop: ViewDrop | null;
}

/**
 * One fact a view contributes to the inspector.
 *
 * The shell renders these in its own idiom. A view says a save state, a time,
 * a count, or a line of text; it never hands over rendered content, because a
 * view rendering into the drawer would make the drawer's look a per-view
 * accident and would own a shell surface in all but name.
 *
 * The vocabulary grows by change when a view needs a shape it lacks. That cost
 * is the point: a shape no vocabulary covers becomes a decision rather than
 * something a view draws on its own.
 */
export type InspectorFact =
  | { readonly kind: "text"; readonly label: string; readonly value: string }
  | {
      readonly kind: "saveState";
      readonly label: string;
      readonly value: SaveState;
    }
  /** An absolute moment, as ISO-8601. The shell decides how a time reads; a
   * relative age would have to keep itself current in a drawer that sits open,
   * and an age that stopped ticking states something false. */
  | { readonly kind: "time"; readonly label: string; readonly value: string }
  | { readonly kind: "count"; readonly label: string; readonly value: number };

/**
 * One action a view contributes. The shell renders the control and the view
 * supplies what it does: the shell knows how to draw a button and a toggle,
 * and knows nothing about what a document is or what deleting one means.
 *
 * One vocabulary, two surfaces: the inspector renders a view's actions and so
 * does the dock. A second type for the same kind of thing would let one view's
 * button and another's disagree about what a named action is.
 */
export type ViewAction =
  | {
      readonly kind: "button";
      readonly id: string;
      readonly label: string;
      /** A destructive action reads as one. The shell decides how. */
      readonly destructive?: boolean;
      readonly run$: QRL<() => void>;
    }
  | {
      readonly kind: "toggle";
      readonly id: string;
      readonly label: string;
      readonly on: boolean;
      readonly run$: QRL<(on: boolean) => void>;
    }
  | {
      /**
       * One value from a named set — a change document's status. The shell
       * renders it as a labelled native select, in the inspector and the
       * dock alike; the view supplies the options in its own words and what
       * choosing one does. An option may name the icon that stands for it,
       * shown beside the control for the current value. BO_0222_007
       */
      readonly kind: "choice";
      readonly id: string;
      readonly label: string;
      readonly value: string;
      readonly options: readonly { readonly value: string; readonly label: string; readonly icon?: IconName }[];
      readonly run$: QRL<(value: string) => void>;
    };

/**
 * One answer on a message. The shell renders the control; the view supplies
 * what pressing it does, the way an inspector action already works.
 *
 * `run$` is optional because an answer that changes nothing has nothing to run.
 * Answering always lowers the message, so a `Cancel` is the answer with no
 * handler rather than an answer whose handler undoes the question.
 */
export interface MessageAnswer {
  readonly id: string;
  readonly label: string;
  /** A destructive answer reads as one. The shell decides how. */
  readonly destructive?: boolean;
  readonly run$?: QRL<() => void>;
}

/**
 * A question the shell asks on a view's behalf.
 *
 * Every message asks. The surface carries no lifetime, so a message stays
 * until one of its answers is pressed; a statement that fades after a few
 * seconds is a different thing and is not built. A message with no answers
 * could therefore never be lowered, which is why `answers` is never empty.
 */
export interface Message {
  readonly headline: string;
  readonly body: string;
  readonly answers: readonly [MessageAnswer, ...MessageAnswer[]];
}

/** The message the shell is showing, or `null` for none. A store for the
 * reason the inspector is one: the shell renders it and raising one writes it.
 */
export interface ViewMessage {
  current: Message | null;
}

/** What the inspector says for the active view right now. A store rather than
 * a value, because the shell renders it and the view writes it: a plain field
 * on a plain object would change without anything re-rendering.
 *
 * `text` is the fallback for a view with nothing structured to say, which is
 * what a placeholder view contributes. */
export interface ViewInspector {
  text: string | null;
  facts: readonly InspectorFact[];
  actions: readonly ViewAction[];
}

/**
 * The one action the active view contributes to the command dock, or `null`
 * for a view that offers none — which is what a placeholder view offers, and
 * what the dock then shows in its place.
 *
 * A store for the reason the inspector is one: the shell renders it and the
 * view writes it, so a plain field would change with nothing re-rendering.
 *
 * The dock is where a view puts the way into a mode of its own. A toggle is
 * what says which mode the surface is in, because the shell draws a toggle as
 * pressed while it is on.
 */
export interface ViewDock {
  action: ViewAction | null;
}

/**
 * How far the active view has got in keeping its work.
 *
 * `unsaved` covers a failed save as well as an untried one: both mean the graph
 * does not hold what the reader typed. Which block a failure happened to is the
 * view's to say, on that block; a tab-level state cannot name one.
 */
export type SaveState = "saving" | "saved" | "unsaved";

/** The active view's save state, as a store for the reason the inspector is
 * one: the shell header renders it and the view writes it. `null` is a view
 * that has not reported, such as a placeholder with nothing to save. */
export interface ViewSave {
  state: SaveState | null;
}

/**
 * The last run aimed at a target that ended, as the shell saw it end.
 *
 * `seq` rises on every end, so a view tells a second run against the same
 * target from the first — the shape `ViewDrop` has, for the same reason. A
 * store, for the reason the inspector is one: the shell writes it and the view
 * reads it, and a plain field would change with nothing re-reading. What the
 * run staged is the view's to read; the shell only says that there is
 * something to read. BO_0226_007
 */
export interface ViewProposed {
  itemId: string | null;
  seq: number;
}

/**
 * The last chip pressed in the composer: which target, what to show in it, and
 * a count that rises with every press, so a second press on the same chip is
 * told from the first — `proposed`'s shape, for `proposed`'s reason. The shell
 * only says what the reader asked to see; scrolling to it and drawing the eye
 * is the view's. CA_0039_004
 */
export interface ViewReveal {
  itemId: string | null;
  target: RevealTarget | null;
  seq: number;
}

/**
 * Something a view has just done that can be taken back: the words the dock's
 * undo line shows, and what taking it back does. The view supplies the inverse
 * because only the view knows what it did; the shell renders the one undo
 * line, so a tab move and a view's change are taken back in one place, the
 * same way. BO_0227_013
 */
export interface UndoOffer {
  readonly label: string;
  readonly undo$: QRL<() => void>;
}

export interface ViewBridge {
  readonly drag: ViewDragState;
  readonly inspector: ViewInspector;
  readonly dock: ViewDock;
  readonly save: ViewSave;
  readonly startDrag$: QRL<(payload: DragPayload, event: PointerEvent) => void>;
  /** Records the view's selection on the active tab, which is what carries it
   * across a tab switch and a reload. */
  readonly setSelection$: QRL<(selection: string | null) => void>;
  /**
   * Records what the reader is pointing at in a target — the blocks and
   * passages they marked, in mark order, and the blocks they pinned — so a
   * command from the composer can carry it (`BO_0227_015`). The same direction as
   * the selection and the same reason — a view asking the shell to record what
   * the reader pointed at — but the marks outlive the press that reaches the
   * composer, where the selection is gone by then (`BO_0226_006`).
   *
   * The view names its target for the reason it names its tab in
   * `setSaveState$`: a report landing after a tab switch must not be filed
   * under whichever target the reader moved to.
   */
  readonly setPointing$: QRL<(itemId: string, pointing: Pointing) => void>;
  /** The last run aimed at a target that ended. BO_0226_007 */
  readonly proposed: ViewProposed;
  /** The last chip the reader pressed in the composer, asking the view to
   * show its area. CA_0039_004 */
  readonly reveal: ViewReveal;
  /** Renames the active tab's target. The shell carries the new name to the
   * tab and to the library entry for the same document. */
  readonly setTitle$: QRL<(title: string) => void>;
  /**
   * Reports the view's save state for the tab it is mounted on. One channel,
   * not two: the header renders it in words and the tab's round marker is
   * projected from it, so the shell cannot hold two answers to whether a tab
   * has unsaved work.
   *
   * The view names its own tab because a save flushed as the view unmounts
   * lands after the switch that unmounted it. Reported as "the active tab", a
   * document's last save would mark whichever tab the reader had moved to.
   */
  readonly setSaveState$: QRL<(tabId: string, state: SaveState) => void>;
  /**
   * Tells the shell that a target no longer exists. Every tab in this
   * workspace showing it closes and the library re-reads, so the reader is not
   * left editing something that has gone.
   *
   * The view says the target is gone because only the view knows what removed
   * it; the shell owns the tabs and closes them.
   */
  readonly targetGone$: QRL<(itemId: string) => void>;
  /**
   * Raises a message on the shell's message surface.
   *
   * A view never renders a message of its own. It says the words and what each
   * answer does; the shell decides how a message reads, where it sits, and
   * that answering lowers it. The surface is above every region, so which
   * region the control that raised it lives in does not matter.
   */
  readonly raiseMessage$: QRL<(message: Message) => void>;
  /**
   * Offers the dock's undo line for what the view just did, replacing
   * whatever it offered before. A tab switch clears it, as it clears the
   * view's dock action: the inverse acts on a surface the reader may have
   * left. BO_0227_013
   */
  readonly offerUndo$: QRL<(offer: UndoOffer) => void>;
  /**
   * Asks the shell to open a target in a tab, or to reveal the tab already
   * showing it. A view that renders links between targets — the owner
   * document's links between an extension's topics and changes — says which
   * target; the shell owns the tabs and opens it. BO_0201_007
   */
  readonly openTarget$: QRL<(target: { kind: TabKind; itemId: string; title: string }) => void>;
  /**
   * Tells the shell that the active tab's target changed in a way a library
   * listing shows without a rename — a change document's status. The
   * sections whose rows open the tab's kind read again. BO_0222_007
   */
  readonly targetChanged$: QRL<() => void>;
}

export const ViewBridgeContext = createContextId<ViewBridge>(
  "calliopa.view-bridge",
);
