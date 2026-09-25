import type { IconName } from "./icons";
import { createContextId, type Component, type QRL } from "@builder.io/qwik";
import type { RouteEntry, TabKind } from "~/lib/tabs";
import type { DragOperation, DragPayload } from "~/lib/drag";
import type {
  AttachmentDescriptor,
  CommandSource,
  Pointing,
  RevealTarget,
} from "~/lib/command-target";
import type { SelectableRuntime } from "~/lib/connections";
import type { Speed } from "~/lib/agent-menu";
import type { DocumentActivity } from "~/server/agent/run-events";
import type { FocusedWork } from "~/server/focused-work";

/**
 * What a view may reach in the shell, and nothing more.
 *
 * A view never owns a shell surface. It contributes to the inspector and to
 * the bar, it asks the shell to record its selection and to send a command,
 * and it uses the
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
 * One vocabulary, two surfaces: the inspector and the bar render a
 * view's actions through one control (`ActionControl`). A second type for the
 * same kind of thing would let one view's button and another's disagree about
 * what a named action is.
 */
export type ViewAction =
  | {
      readonly kind: "button";
      readonly id: string;
      readonly label: string;
      /** Shown in place of the label, which stays the accessible name and
       * the tooltip. CA_0053_002 */
      readonly icon?: IconName;
      /** The accessible name, where it says more than the label shown — the
       * block a bar button acts on. CA_0053_002 */
      readonly name?: string;
      /** A destructive action reads as one. The shell decides how. */
      readonly destructive?: boolean;
      /** Genuinely unavailable, such as undo with no history. CA_0053_002 */
      readonly disabled?: boolean;
      /** The control keeps the text selection it acts on: the shell stops the
       * press from taking focus, which would collapse the range. CA_0053_002 */
      readonly keepsSelection?: boolean;
      readonly run$: QRL<() => void>;
    }
  | {
      readonly kind: "toggle";
      readonly id: string;
      readonly label: string;
      /** CA_0053_002, as on a button. */
      readonly icon?: IconName;
      readonly name?: string;
      readonly keepsSelection?: boolean;
      readonly on: boolean;
      readonly run$: QRL<(on: boolean) => void>;
    }
  | {
      /**
       * A line of text the reader types and then applies — a link's address.
       * The view keeps the draft: `input$` hands it every keystroke and
       * `submit$` applies what it holds, as the button labelled `submitLabel`
       * and Enter both do. CA_0053_002
       */
      readonly kind: "field";
      readonly id: string;
      readonly label: string;
      readonly value: string;
      readonly type?: "text" | "url";
      readonly submitLabel: string;
      readonly input$: QRL<(value: string) => void>;
      readonly submit$: QRL<() => void>;
    }
  | {
      /**
       * One value from a named set — a change document's status. The shell
       * renders it as a labelled native select, in the inspector and the
       * bar alike; the view supplies the options in its own words and what
       * choosing one does. An option may name the icon that stands for it,
       * shown beside the control for the current value. BO_0222_007
       */
      readonly kind: "choice";
      readonly id: string;
      readonly label: string;
      readonly value: string;
      readonly options: readonly { readonly value: string; readonly label: string; readonly icon?: IconName }[];
      readonly run$: QRL<(value: string) => void>;
    }
  | {
      /**
       * A control that opens a panel of the view's own words beside it: what
       * something means, in the view's vocabulary, where the reader is already
       * looking. The shell draws the control and the panel and knows nothing
       * of what is said; the view supplies the lines, each an optional term
       * and its text. It closes on a press outside and on Escape, which
       * returns focus to the control. The fourth kind of the one action
       * vocabulary. User decision, 2026-09-21 (`BO_0272_014`).
       */
      readonly kind: "popover";
      readonly id: string;
      readonly label: string;
      readonly icon?: IconName;
      readonly name?: string;
      /** The panel's heading, where the label alone does not say enough. */
      readonly heading?: string;
      readonly lines?: readonly {
        readonly term?: string;
        readonly text: string;
      }[];
      /**
       * A body of the view's own in place of the lines (`BO_0291_033`): a
       * component the shell draws inside the panel with the props the view
       * gives it and a `close$` of the shell's, so a panel can hold a
       * search and choices — the document view's source chooser — and close
       * itself once a choice is made. The shell still draws the control and
       * the panel, places it, and closes it on Escape and a press outside;
       * it knows nothing of what the body says or does.
       */
      readonly body?: {
        readonly component: Component<PopoverBodyProps & Record<string, unknown>>;
        readonly props?: Readonly<Record<string, unknown>>;
      };
    };

/** What the shell hands a popover's body beside the view's own props. */
export interface PopoverBodyProps {
  readonly close$: QRL<() => void>;
}

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
 * One group of the view's bar: controls in the named-action vocabulary under
 * an accessible name. The shell draws a line between two groups it draws and
 * puts the trailing group at the bar's trailing edge. CA_0053_001
 */
export interface ViewBarGroup {
  readonly id: string;
  readonly label: string;
  /** Drawn at the bar's trailing edge, whatever the other groups hold. */
  readonly trailing?: boolean;
  readonly actions: readonly ViewAction[];
}

/**
 * The bar the shell draws at the top of the tab's region, from the groups the
 * active view contributes, and no bar while it contributes none. A store for
 * the reason the inspector is one: the shell renders it and the view writes
 * it. A view contributing a bar keeps its content clear of `--view-bar-height`
 * at its top, as the block editor does. CA_0053_001
 */
export interface ViewBar {
  groups: readonly ViewBarGroup[];
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
 * One of the reader's runs aimed at a target, as the shell follows it: what
 * it has done there so far, in order, and whether it is still going. The view
 * draws what the run does at its blocks; the shell only carries it.
 * BO_0265_007
 */
export interface ViewRunActivity {
  readonly itemId: string;
  readonly runId: string;
  /** The agent the reader ran it on, for the face its chip and its marks
   * show before the run has staged anything. */
  readonly agent: string | null;
  readonly running: boolean;
  readonly events: readonly DocumentActivity[];
}

/**
 * Every run the reader started this session and aimed at a target, several
 * at once when they go side by side, newest last. `seq` rises whenever any of
 * them changes, `proposed`'s shape for `proposed`'s reason. BO_0269_014
 */
export interface ViewActivity {
  runs: readonly ViewRunActivity[];
  seq: number;
}

/** Who a run chip belongs to, drawn as the proposal's face is. */
export type RunChipFace =
  | { readonly kind: "image"; readonly src: string }
  | { readonly kind: "icon"; readonly icon: IconName };

/**
 * One open run group on the view's target, as the view reports it for the
 * composer to draw above the command field: whose run, one line of what it is
 * doing or did, and — once it has ended — *Reject all* and *Accept all*.
 * BO_0265_008
 */
export interface RunChip {
  /** The group, or the run while it has staged nothing yet. */
  readonly key: string;
  readonly group: string | null;
  readonly face: RunChipFace;
  /** The proposer's colour, as the proposal takes it. */
  readonly tone: string;
  /** Whose run, in words: *Claude Code (claude-sonnet-5)*. */
  readonly name: string;
  readonly text: string;
  /** The open changes the group holds, the number the words count in words:
   * *3 rewrites, 1 insert* is 4. A minimized chip draws it in place of the
   * words, so the shell never reads a number out of them; a run that has
   * staged nothing has none. CA_0061_002 */
  readonly count?: number;
  readonly ended: boolean;
  /** Whether the change's proposals are shown in the view, which the chip's
   * pressed state says. CA_0055_002 A session the tab works in is shown: it
   * is the document the tab reads. CA_0057_014 */
  readonly shown: boolean;
  /** The reader's own proposal session rather than a run: its answers stand
   * at once, and a pencil beside its words works in it. CA_0057_003
   * CA_0057_014 */
  readonly session?: boolean;
  /** A session the tab works in: its edits go into it. CA_0057_014 */
  readonly working?: boolean;
  /** Someone else accepts it, under separation of duties: the chip offers no
   * *Accept all*. CA_0057_003 */
  readonly accepts?: "others";
}

/**
 * The last press on a run chip itself, asking the view showing its target to
 * show or hide that change's proposals, `reveal`'s shape for `reveal`'s
 * reason. CA_0055_002
 */
export interface ViewToggleRun {
  itemId: string | null;
  key: string | null;
  seq: number;
  /** The press was a session chip's pencil: work in it, or stop. CA_0057_014 */
  work?: boolean;
}

/**
 * The last *Reject all* or *Accept all* pressed on a run chip, for the view
 * showing its target to answer, `reveal`'s shape for `reveal`'s reason.
 * BO_0265_008
 */
export interface ViewAnswerAll {
  itemId: string | null;
  group: string | null;
  answer: "accepted" | "rejected" | null;
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
 * The pointing that stands across the workspace: which prompt is pointing,
 * from which document, and the marks it has so far — so pointing follows the
 * reader across tabs (`BO_0304_Q1`). Only the active tab's view is mounted,
 * so the marks cannot live in the prompt's view while the reader is in
 * another document; they live here while the pointing stands. The view that
 * points writes it and every view reads it: a view the session does not
 * name is its guest, marking for it. `marks` is the record as the pointing
 * view serializes it, opaque to the shell; `documents` are the documents
 * marked whole, which the library and the tab strip show. `seq` rises on
 * every change. BO_0304_014
 */
export interface ViewPointing {
  documentId: string | null;
  prompt: string | null;
  marks: string;
  documents: readonly { readonly document: string; readonly title: string; readonly number: number }[];
  seq: number;
}

/**
 * The last *Mark document* pressed on a library row or a tab while a pointing
 * stands, for the mounted document view — the one that points, or its guest
 * — to apply to the session's marks, `reveal`'s shape for `reveal`'s reason.
 * The view clears `document` once it has applied it. BO_0304_014
 */
export interface ViewAcross {
  document: string | null;
  title: string;
  seq: number;
}

/**
 * A block the view is asked to focus once it shows a target: coming back to
 * a parent from its focused work lands on the block that was opened, with
 * its depth. Page-only, never the workspace record — focus is never
 * persisted (`CA_0046_001`). CA_0047_004
 */
export interface ViewFocus {
  itemId: string | null;
  blockId: string | null;
  seq: number;
}

/**
 * The agents a view's command control offers: the list and the choice the
 * dock's dropdown reads, since a choice on a block is the instance's choice,
 * and whether a command is being sent. The shell writes it; a view reads it
 * and chooses through `chooseAgent$`. BO_0267_008
 */
export interface ViewAgents {
  runtimes: SelectableRuntime[];
  agent: string | null;
  /** What the reader chose on the chosen sender's axes. BO_0279_007 */
  options: Record<string, string>;
  /** What the next press would cost, or "" when nothing can say. BO_0279_009 */
  cost: string;
  /** The next command's speed, the person's. BO_0269_015 */
  speed: Speed;
  sending: boolean;
}

/**
 * A command sent from a block of the view's target: the block and the
 * revision sent, and the files attached to it. The marks it carries are the
 * ones the view last reported for the target (`setPointing$`), copied at the
 * press; the words are the block's, which the kernel reads from the revision
 * and the shell reads here only to refuse a `#n` no mark stands under.
 * BO_0267_008
 */
export interface ViewCommand {
  readonly itemId: string;
  readonly source: CommandSource;
  readonly words: string;
  readonly attachments: readonly AttachmentDescriptor[];
}

/**
 * A gesture a view offers: a question it asks of one extension about one
 * subject, which the reader invited by pressing it. Where a command is words
 * a person wrote in a block, a gesture is a question the surface already knew
 * how to ask, so it carries its own goal and names the intention that answers
 * it. The shell starts it and follows it as it follows a command's.
 * BO_0258_006
 */
export interface ViewGesture {
  /** The tab's target the gesture was made in, which the run proposes into. */
  readonly itemId: string;
  /** The question, in the words the reader is owed an answer to. */
  readonly goal: string;
  /** The `ext.intention` that answers it; the kernel refuses one whose
   * extension is switched off, by name. BO_0264_006 */
  readonly intention: string;
  /** What the run is told beside the question: the extension building it
   * reads it from the graph at the pin the question is asked at, so the run
   * need not reconstruct the subject. BO_0258_006 */
  readonly context?: string;
}

/** What sending a command answered: the run it started, or the refusal in
 * words for the view to show beside its control. */
export type SentCommand =
  | { readonly ok: true; readonly runId: string }
  | { readonly ok: false; readonly error: string };

/**
 * Words asked for a document's next command — a challenge to a derived
 * framing — which the view showing the document puts into a new block, since
 * a document's commands are written in its blocks. `seq` rises with every
 * ask, `reveal`'s shape for `reveal`'s reason. BO_0267_016
 */
export interface ViewComposeBlock {
  itemId: string | null;
  text: string;
  seq: number;
}

/**
 * One control the shell contributes into a view's own block row
 * (`CA_0065_004`).
 *
 * The contract has carried a view's contributions to the shell and nothing
 * the other way; focused work needs the other way, because opening a block as
 * its own work root is the frame's capability and a reader must be able to
 * reach it on every install rather than only where some extension draws it.
 *
 * The shell says which controls exist, what they are called and what they do;
 * the view says where they are drawn. A view renders each through
 * `ActionControl` in the one named-action vocabulary, wrapping it in a
 * `ViewAction` whose `run$` calls `pressBlockControl$`. It may not change a
 * control's words, its order among the shell's, or whether it is offered — a
 * capability the frame provides is not an extension's to withhold.
 */
export interface BlockControl {
  readonly id: string;
  /** The accessible name and the tooltip; shown where the icon is not. */
  readonly label: string;
  readonly icon: IconName;
}

export interface ViewBridge {
  /**
   * The workspace the view is mounted in, read-only: what a contributed view
   * names when it creates a process through the shell's registry, the way the
   * composer's run does. A view never changes the workspace it is in. CA_0050_001
   */
  readonly workspaceId: string;
  readonly drag: ViewDragState;
  readonly inspector: ViewInspector;
  /** The bar at the top of the tab's region. CA_0053_001 */
  readonly bar: ViewBar;
  /**
   * What an extension decorating the active view adds to that bar
   * (`BO_0274_004`): its own groups, merged into the view's by id — appended
   * to the group of that name where the view has one, standing after the
   * view's groups where it has none. A store for the reason `bar` is one, and
   * a store of its own because the view and its decorations both write:
   * sharing one would let whichever wrote last drop the other's controls. A
   * view contributing no bar is given none by a decoration alone.
   */
  readonly decorationBar: ViewBar;
  readonly save: ViewSave;
  readonly startDrag$: QRL<(payload: DragPayload, event: PointerEvent) => void>;
  /** Records the view's selection on the active tab, which is what carries it
   * across a tab switch and a reload. */
  readonly setSelection$: QRL<(selection: string | null) => void>;
  /**
   * Records what the reader is pointing at in a target — the blocks and
   * passages they marked from the prompt block being edited, in mark order,
   * and the blocks they pinned — so the command sent from that block carries
   * it (`BO_0227_015`, `BO_0267_008`). The same direction as
   * the selection and the same reason — a view asking the shell to record what
   * the reader pointed at — but the marks outlive the press that reaches the
   * composer, where the selection is gone by then (`BO_0226_006`).
   *
   * The view names its target for the reason it names its tab in
   * `setSaveState$`: a report landing after a tab switch must not be filed
   * under whichever target the reader moved to.
   */
  readonly setPointing$: QRL<(itemId: string, pointing: Pointing) => void>;
  /** Records the branch a document's tab works in, or none, so the composer's
   * strip says the run proposes into it and the run names it. BO_0250_010 */
  readonly setBranch$: QRL<(itemId: string, branch: string | null) => void>;
  /** The last run aimed at a target that ended. BO_0226_007 */
  readonly proposed: ViewProposed;
  /** The last chip the reader pressed in the composer, asking the view to
   * show its area. CA_0039_004 */
  readonly reveal: ViewReveal;
  /** The pointing that stands across the workspace. BO_0304_014 */
  readonly pointing: ViewPointing;
  /** The last *Mark document* pressed while it stands. BO_0304_014 */
  readonly across: ViewAcross;
  /** The reader's run aimed at a target, while it goes. BO_0265_007 */
  readonly activity: ViewActivity;
  /** Reports the open run groups on a target for the composer's chips.
   * BO_0265_008 */
  readonly setRunChips$: QRL<(itemId: string, chips: readonly RunChip[]) => void>;
  /** The last *Reject all* or *Accept all* pressed on a chip. BO_0265_008 */
  readonly answerAll: ViewAnswerAll;
  /** The last press on a chip itself. CA_0055_002 */
  readonly toggleRun: ViewToggleRun;
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
  /**
   * Tells the shell that what the agents can do may have changed — a sign-in
   * the view followed ended — so the command bar reads the list again rather
   * than offering what the page read when it opened. The view says only that
   * something changed; the server's list says what. CA_0052_002
   */
  readonly agentsChanged$: QRL<() => void>;
  /** Puts words into the next command for the reader to finish and send: the
   * composer's field, or on a document tab a new block (`composeBlock`).
   * CA_0046_006 BO_0267_008 */
  readonly composeCommand$: QRL<(text: string) => void>;
  /** Words asked for a document tab's next command. BO_0267_016 */
  readonly composeBlock: ViewComposeBlock;
  /** The agents a command control offers. BO_0267_008 */
  readonly agents: ViewAgents;
  /** Chooses the agent for the next command, the instance's choice. */
  readonly chooseAgent$: QRL<(agent: string) => void>;
  /** Turns one axis of the chosen sender. BO_0279_007 */
  readonly chooseOption$: QRL<(axis: string, value: string) => void>;
  /**
   * Asks what a press on this block would cost, for the sender and the axes
   * chosen now, and keeps it in `agents.cost`. Free, and never a press.
   * BO_0279_009
   */
  readonly quoteSend$: QRL<(documentId: string, blockId: string) => Promise<void>>;
  /** Chooses the next command's speed. BO_0269_015 */
  readonly chooseSpeed$: QRL<(speed: Speed) => void>;
  /** Reads the agents again, answering the list, or null when it could not.
   * CA_0052_001 */
  readonly refreshAgents$: QRL<() => Promise<readonly SelectableRuntime[] | null>>;
  /**
   * Sends a command written in a block of the view's target: the shell starts
   * the run on the chosen agent, proposing into the target, and follows it as
   * it follows the composer's. BO_0267_008
   */
  readonly sendCommand$: QRL<(command: ViewCommand) => Promise<SentCommand>>;
  /**
   * Asks a gesture's question: the shell starts a run for the goal under the
   * named intention, on the chosen agent, proposing into the target, and
   * follows it as it follows a command's — so the run's chip and the work it
   * proposes arrive where every other run's do. BO_0258_006
   */
  readonly sendGesture$: QRL<(gesture: ViewGesture) => Promise<SentCommand>>;
  /**
   * Retargets the active tab in place — opening a block as focused work, or
   * going back along the route — keeping the tab and its view; the shell
   * rewrites the tab's target, title and route in the workspace record and
   * remounts the view. `focus` names the block to land on. CA_0047_004
   */
  readonly retarget$: QRL<(target: { itemId: string; title: string; route: readonly RouteEntry[]; focus?: string }) => void>;
  /** The block to focus once the retargeted view shows. CA_0047_004 */
  readonly focus: ViewFocus;
  /**
   * The shell's own controls for one block of the view's target, which the
   * view draws in its block row and the shell fills. Answered for the blocks
   * a reader has turned to, so the words say whether the block already has
   * focused work. CA_0065_004
   */
  readonly blockControls$: QRL<(itemId: string, blockId: string) => Promise<readonly BlockControl[]>>;
  /**
   * Presses one of them. The shell acts — for focused work it opens or finds
   * the child and retargets the tab, pushing the parent onto the route with
   * the block it was opened from — and answers the refusal in words for the
   * view to show, or `null` when it did what it says. CA_0065_003
   */
  readonly pressBlockControl$: QRL<
    (control: string, target: { itemId: string; blockId: string; title: string; route: readonly RouteEntry[] }) => Promise<string | null>
  >;
  /**
   * What each block of a target that has focused work says for itself: the
   * child's title, and its own words when it holds any. Read on the first
   * focus in a target, never on the target's own read, so faces cost nothing
   * until a reader turns to a block. What the line looks like is the view's.
   * CA_0065_005
   */
  readonly faces$: QRL<(itemId: string) => Promise<FocusedWork>>;
}

export const ViewBridgeContext = createContextId<ViewBridge>(
  "calliopa.view-bridge",
);
