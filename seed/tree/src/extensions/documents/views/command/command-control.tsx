import { $, component$, useContext, useSignal, type QRL } from "@builder.io/qwik";

import { AgentMenu } from "~/components/shell/agent-menu";
import { SpeedToggle } from "~/components/shell/speed-toggle";
import { AttachButton, AttachmentChips } from "~/components/shell/command-attachments";
import { Icon } from "~/components/shell/icons";
import { ReferenceChips } from "~/components/shell/reference-chips";
import { ViewBridgeContext, type SentCommand } from "~/components/shell/view-bridge";
import { readyDescriptors, stillUploading, uploadingNames, type AttachmentHolder } from "~/lib/attachments";
import type { AttachmentDescriptor, RevealTarget } from "~/lib/command-target";
import { pendingBlockReference, pendingReference, referenceMatches } from "~/lib/command-typeahead";
import { replaceRangeWithAtom, replaceRangeWithRuns, runsPoints, type MarkRef, type Run } from "~/lib/runs";
import { BlockDecorations, placeContributed } from "../decorations";
import { MarkingContext } from "../marking/use-marking";
import { matchingChoices, type ReferenceChoice } from "../../lib/reference-choices";
import { markRefFrom } from "../../lib/reference-title";
import { askReveal } from "../reveal";
import { matchingEntries, offersCreate, pendingTrigger, type TriggerEntry } from "../../lib/inline-triggers";
import { InlineTriggersContext, triggersByCharacter } from "../inline-triggers";
import type { EditorState } from "../block-editor";
import { sendName, type CommandChoice } from "../../lib/command-choices";
import { POLES, toggleName } from "../../lib/working-mode";

/**
 * The command control on the block being edited, or on the prompt pointed
 * from: the agent, its speed, the working mode's two toggles, *Point from
 * this block*, *Attach files*, the chips of what the command carries, *Keep
 * as content* and *Send*, on the block's bottom border, the line proposals
 * use. BO_0267_012 DO_0025_001 DO_0025_003
 *
 * The agents are the shell's (`bridge.agents`), so a choice here is the
 * instance's; the marks are the prompt's (`MarkingContext`); the send is the
 * editor's `send$`, which saves the block and hands its revision to the
 * shell. A refusal is said beside the control, in words.
 */

/** Where `#` stands before the caret, in the code points the editor counts. */
function pendingAt(runs: readonly Run[], caret: number): { readonly start: number; readonly typed: string } | null {
  // Measured in points, an atom one each, so a citation before the `#` does
  // not shift the range (BO_0300 walk, 2026-09-25).
  const points = [...runsPoints(runs)];
  const before = points.slice(0, caret).join("");
  const pending = pendingReference(before, before.length);
  if (pending === null) return null;
  return { start: [...before.slice(0, pending.start)].length, typed: pending.typed };
}

/** The `#` and the words typed after it before the caret, for a reference to
 * a block of the document (`BO_0300_005`); the same offsets as `pendingAt`. */
function pendingBlockAt(runs: readonly Run[], caret: number): { readonly start: number; readonly typed: string } | null {
  const points = [...runsPoints(runs)];
  const before = points.slice(0, caret).join("");
  const pending = pendingBlockReference(before, before.length);
  if (pending === null) return null;
  return { start: [...before.slice(0, pending.start)].length, typed: pending.typed };
}

/** The key that sends, for the tooltip: the listener takes `Ctrl` and `Cmd`
 * alike, and the words name the one this platform presses. DO_0015_007 */
const sendShortcut = (): string =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/u.test(navigator.platform) ? "⌘+Enter" : "Ctrl+Enter";

/** The pinch's two controls on the line, named for what they start. BO_0322_012 */
const pinchControl = {
  in: { name: "Deepen", title: "Deepen: search for news, add detail, leave the block clear and complete", icon: "magnifying-glass-plus" },
  out: { name: "Gather", title: "Gather: summarize the block and move the neighbours that fit into its focused work", icon: "magnifying-glass-minus" },
} as const;

export const CommandControl = component$<{
  documentId: string;
  blockId: string;
  editor: EditorState;
  /** Whether the reader is pointing from this block. */
  pointing: boolean;
  send$: QRL<(blockId: string, asPrompt: boolean, attachments: readonly AttachmentDescriptor[]) => Promise<SentCommand & { readonly note?: string }>>;
  /** How this block is sent: *Keep as content* and its working mode. DO_0025 */
  choice: CommandChoice;
  setKeep$: QRL<(blockId: string, keep: boolean) => void>;
  /** Starts the run a pinch starts on this block, without the gesture:
   * *Deepen* zooms in, *Gather* zooms out. BO_0322_012 */
  pinch$: QRL<(pinch: "in" | "out", blockId: string) => Promise<SentCommand>>;
  switchMode$: QRL<(blockId: string, axis: "field" | "work") => void>;
  editRuns$: QRL<(runs: Run[], start: number, end: number) => Promise<void>>;
  /** Edits the block again once pointing from it ends. */
  resume$: QRL<() => void>;
  /** The files the block's command carries: the editor's, kept per block for
   * the page, so a file dropped on the block lands here too. */
  files: AttachmentHolder;
  /** The blocks a `#` in this block may refer to (`BO_0300_005`), offered
   * when the block points at nothing: a block with marks is a prompt, and its
   * `#` keeps meaning the mark (user decision, 2026-09-25). */
  references?: readonly ReferenceChoice[];
}>(({ documentId, blockId, editor, pointing, send$, choice, setKeep$, pinch$, switchMode$, editRuns$, resume$, files, references }) => {
  const bridge = useContext(ViewBridgeContext);
  const { store: marking, point$, toggleReference$ } = useContext(MarkingContext);
  const inlineTriggers = useContext(InlineTriggersContext, null);
  const notice = useSignal<string | null>(null);

  /** What a `command` place says about this command, kept by the shell and
   * sent with it. BO_0311_030 */
  const setOption$ = $((name: string, value: string | null, once?: boolean) =>
    bridge.setCommandOption$(documentId, blockId, name, value, once),
  );

  /** Sends the way *Keep as content* says. DO_0025_001 */
  const send = $(async (asPrompt: boolean) => {
    // A file still uploading holds the command: sent now, it would go without
    // the file the reader sees on the line. BO_0229_010
    const uploading = uploadingNames(files.attachments);
    if (uploading.length > 0) {
      notice.value = stillUploading(uploading);
      return;
    }
    notice.value = null;
    const answer = await send$(blockId, asPrompt, readyDescriptors(files.attachments));
    if (!answer.ok) {
      notice.value = answer.error;
      return;
    }
    files.attachments = [];
    files.attachNotice = null;
    // A send that started the run but could not keep its mode as the
    // document's last says so here. DO_0025_003
    if (answer.note !== undefined) notice.value = answer.note;
  });

  /** Shows what a chip points at, here or in its own document. */
  const reveal$ = $((target: RevealTarget) => askReveal(bridge, documentId, target));

  /** A mark chosen from a prompt's list is written as one atom bound to what
   * was marked, not as `#n` (`BO_0352_010`, `DO_0041_Q2`), the `#` and the
   * digits taken back, a space after it and the caret after the space. */
  const choose$ = $(async (number: number) => {
    if (editor.blockId !== blockId) return;
    const pending = pendingAt(editor.runs, editor.start);
    if (pending === null) return;
    const reference = marking.report.references.find((shown) => shown.number === number);
    if (reference === undefined) return;
    const runs = replaceRangeWithRuns(editor.runs, pending.start, editor.end, [{ text: "", markRef: markRefFrom(reference) }, { text: " " }]);
    const caret = pending.start + 2;
    await editRuns$(runs, caret, caret);
  });

  /** A reference to a block written where the `#` was typed (`BO_0300_005`):
   * one atom carrying the block's identity, the `#` and the words after it
   * taken back, the caret after the atom. */
  const chooseBlock$ = $(async (target: string) => {
    if (editor.blockId !== blockId) return;
    const pending = pendingBlockAt(editor.runs, editor.start);
    if (pending === null) return;
    const runs = replaceRangeWithAtom(editor.runs, pending.start, editor.end, { text: "", blockRef: target });
    const caret = pending.start + 1;
    await editRuns$(runs, caret, caret);
  });

  /**
   * A block chosen from the list in a prompt is marked for the prompt, with
   * the next number, and named by it where the `#` was typed — the picker
   * `BO_0304_Q1` deferred, done as marking, so the run keeps its one
   * vocabulary (user decision, 2026-09-25, `BO_0304_016`). A block already
   * marked is named by the number it carries.
   */
  const chooseBlockAsMark$ = $(async (target: string) => {
    if (editor.blockId !== blockId) return;
    const pending = pendingBlockAt(editor.runs, editor.start);
    if (pending === null) return;
    const held = marking.report.references.find((reference) => reference.kind === "block" && reference.blockId === target && reference.document === undefined && reference.target === undefined);
    const number = held?.number ?? marking.marking.next;
    if (held === undefined) await toggleReference$(target);
    // The mark is reported after this press, so a block marked now is
    // written from what the list shows of it. BO_0352_010
    const shown = (references ?? []).find((choice) => choice.blockId === target);
    const markRef: MarkRef = held !== undefined
      ? markRefFrom(held)
      : { number, kind: "block", blockId: target, ...(shown !== undefined ? { words: shown.glimpse !== "" ? shown.glimpse : shown.label } : {}) };
    const runs = replaceRangeWithRuns(editor.runs, pending.start, editor.end, [{ text: "", markRef }, { text: " " }]);
    const caret = pending.start + 2;
    await editRuns$(runs, caret, caret);
  });

  /**
   * An entry of an extension's trigger chosen (`BO_0310_011`): the character
   * and the words typed after it replaced with the run the extension answers,
   * and a space after it, so what is typed next is the sentence's own; the
   * caret after the space.
   */
  const chooseTrigger$ = $(async (character: string, entry: TriggerEntry) => {
    if (editor.blockId !== blockId) return;
    const trigger = triggersByCharacter(inlineTriggers)[character];
    if (trigger === undefined) return;
    const pending = pendingTrigger(editor.runs, editor.start, [character]);
    if (pending === null) return;
    const run = await trigger.run$(entry);
    const runs = replaceRangeWithRuns(editor.runs, pending.start, editor.end, [run, { text: " " }]);
    const caret = pending.start + [...run.text].length + 1;
    await editRuns$(runs, caret, caret);
  });

  /** The last entry: the extension creates one for the words typed, then it
   * is chosen as any other; a refusal is said beside the control. */
  const createTrigger$ = $(async (character: string, typed: string) => {
    const trigger = triggersByCharacter(inlineTriggers)[character];
    if (trigger?.create$ === undefined) return;
    const made = await trigger.create$(typed.trim());
    if ("failure" in made) {
      notice.value = made.failure;
      return;
    }
    notice.value = null;
    await chooseTrigger$(character, made);
  });

  const editing = editor.blockId === blockId;
  // What the block's `#` means depends on the block (`BO_0300_Q2`): a prompt
  // — one that points at marks — offers its marks by number and, after them,
  // the document's blocks, which choosing marks (`BO_0304_016`); any other
  // block offers the document's blocks and choosing writes a reference.
  const isPrompt = marking.report.references.length > 0;
  const pending = editing && isPrompt && editor.start === editor.end ? pendingAt(editor.runs, editor.start) : null;
  const matches = pending === null ? [] : referenceMatches(marking.report.references, pending.typed);
  const pendingBlock = editing && editor.start === editor.end ? pendingBlockAt(editor.runs, editor.start) : null;
  // In a prompt a block already marked stands in the list as its mark.
  const markedBlocks = new Set(marking.report.references.flatMap((reference) => (reference.kind === "block" && reference.document === undefined ? [reference.blockId] : [])));
  const blockMatches = pendingBlock === null ? [] : matchingChoices(references ?? [], pendingBlock.typed).filter((choice) => !isPrompt || !markedBlocks.has(choice.blockId));
  const sending = bridge.agents.sending;
  // An extension's trigger typed at the caret: its entries narrowed by the
  // words after it, and its create last. BO_0310_011
  const registered = triggersByCharacter(inlineTriggers);
  const pendingInline = editing && editor.start === editor.end ? pendingTrigger(editor.runs, editor.start, Object.keys(registered)) : null;
  const inlineTrigger = pendingInline === null ? undefined : registered[pendingInline.character];
  const inlineMatches = pendingInline === null || inlineTrigger === undefined ? [] : matchingEntries(inlineTrigger.entries, pendingInline.typed);
  const inlineCreate =
    pendingInline !== null && inlineTrigger?.create$ !== undefined && inlineTrigger.createLabel !== undefined && offersCreate(inlineTrigger.entries, inlineMatches, pendingInline.typed);

  return (
    // Its presses are its own: a press here reaching the row would read as a
    // press on the block — marking it, or ending pointing from it.
    <div class="block-command" data-block-command={blockId} role="group" aria-label="Command" stoppropagation:click>
      <div class="block-command__row" data-block-command-row>
        <div class="block-command__line" data-block-command-controls>
          {/* One chip holds the whole line: the agent, its speed, the mode,
              pointing and attaching, then what the command carries, then Keep as
              content and Send at the end. Every button is one size.
              BO_0267_027 BO_0267_028 DO_0025_005 */}
          <AgentMenu
            runtimes={bridge.agents.runtimes}
            value={bridge.agents.agent}
            disabled={sending}
            onChoose$={bridge.chooseAgent$}
            refresh$={bridge.refreshAgents$}
          />
          <SpeedToggle value={bridge.agents.speed} disabled={sending} onChoose$={bridge.chooseSpeed$} />
          {/* The command's working mode, this block's alone: each toggle wears
              the pole in force and switches to the other. DO_0025_003 */}
          <button
            type="button"
            class="block-command__mode"
            data-block-mode="field"
            data-block-mode-pole={choice.mode.field}
            aria-label={toggleName(choice.mode.field)}
            title={toggleName(choice.mode.field)}
            disabled={sending}
            onClick$={() => switchMode$(blockId, "field")}
          >
            <Icon name={POLES[choice.mode.field].icon} />
          </button>
          <button
            type="button"
            class="block-command__mode"
            data-block-mode="work"
            data-block-mode-pole={choice.mode.work}
            aria-label={toggleName(choice.mode.work)}
            title={toggleName(choice.mode.work)}
            disabled={sending}
            onClick$={() => switchMode$(blockId, "work")}
          >
            <Icon name={POLES[choice.mode.work].icon} />
          </button>
          <button
            type="button"
            class="block-command__point"
            data-block-point
            aria-pressed={pointing}
            aria-label="Point from this block"
            title="Point from this block"
            // Pointing ends where it began: back in the prompt's words.
            onClick$={async () => {
              if (!pointing) {
                await point$(blockId);
                return;
              }
              await point$(null);
              if (editor.blockId !== blockId) await resume$();
            }}
          >
            <Icon name="crosshair-simple" />
          </button>
          <AttachButton holder={files} disabled={sending} />
          {/* What an extension offers on this block, before the chips of what the
              command carries. The chip knows nothing of what it draws. BO_0273_009 */}
          <BlockDecorations
            at="command"
            documentId={documentId}
            blockId={blockId}
            revisionId={editor.blockId === blockId ? editor.baseRevisionId : ""}
            active={editing}
            setOption$={setOption$}
          />
          <AttachmentChips holder={files} />
          <ReferenceChips pointing={marking.report} onReveal$={reveal$} />
          {/* Keep as content, always just before Send: on, a send keeps the
              block as content; off, it sends the block as a prompt. DO_0025_001 */}
          <button
            type="button"
            class="block-command__keep"
            data-block-keep
            aria-pressed={choice.keep}
            aria-label="Keep as content"
            title="Keep as content"
            disabled={sending}
            onClick$={() => setKeep$(blockId, !choice.keep)}
          >
            <Icon name="push-pin" />
          </button>
          {/* The pinch without a gesture, just before Send: each starts the
              run its pinch starts on this block, with no words, whatever the
              field holds, and leaves the block's choices as they were.
              BO_0322_012 */}
          {(["in", "out"] as const).map((pinch) => (
            <button
              key={pinch}
              type="button"
              class="block-command__pinch"
              data-block-pinch={pinch}
              aria-label={pinchControl[pinch].name}
              title={pinchControl[pinch].title}
              disabled={sending}
              onClick$={async () => {
                notice.value = null;
                const answer = await pinch$(pinch, blockId);
                if (!answer.ok) notice.value = answer.error;
              }}
            >
              <Icon name={pinchControl[pinch].icon} />
            </button>
          ))}
          <button
            type="button"
            class="block-command__send-main"
            data-block-send
            aria-label={choice.keep ? "Send, keep as content" : "Send as prompt"}
            title={sendName(choice.keep, sendShortcut())}
            disabled={sending}
            onClick$={() => send(!choice.keep)}
          >
            <Icon name="play" />
          </button>
        </div>
        {/* The block's roles in a chip of their own, beside the command chip
            on its row and aligned right when the row has room for both, and
            on the next row, still at the right, when it has not. Inside the
            control, so the two follow the edit together and a press in it is
            the control's own; drawn only when something would stand in it.
            RO_0002_002, after the walk */}
        {placeContributed("underCommand") && (
          <div class="block-command__under" data-block-command-under>
            <BlockDecorations
              at="underCommand"
              documentId={documentId}
              blockId={blockId}
              revisionId={editor.blockId === blockId ? editor.baseRevisionId : ""}
              active={editing}
            />
          </div>
        )}
      </div>
      {(matches.length > 0 || blockMatches.length > 0) && (
        // One list: the prompt's marks by number first, then the blocks of
        // the document it may refer to or mark. Below the row, so it covers
        // neither the block nor its words. BO_0300_005 BO_0304_016 DO_0033_002
        <ul class="block-command__references composer__references" aria-label={isPrompt ? "Name a reference" : "Refer to a block"} data-block-reference-list>
          {matches.map((reference) => (
            <li key={`mark-${reference.number}`}>
              <button
                type="button"
                data-reference-option={reference.number}
                // The block keeps its caret: a press here must not take the
                // focus, or leaving the block would end the edit first.
                preventdefault:mousedown
                onClick$={() => choose$(reference.number)}
              >
                <span class="composer__number">#{reference.number}</span>
                <q>{reference.words}</q>
                {(reference.kind === "document" || reference.document !== undefined) && (
                  <span class="chip__meta">{reference.documentTitle ?? reference.document}</span>
                )}
              </button>
            </li>
          ))}
          {blockMatches.map((choice) => (
            <li key={choice.blockId}>
              <button
                type="button"
                data-block-reference-option={choice.blockId}
                // The block keeps its caret, as a mark's option does.
                preventdefault:mousedown
                onClick$={() => (isPrompt ? chooseBlockAsMark$(choice.blockId) : chooseBlock$(choice.blockId))}
              >
                <Icon name={choice.icon} />
                <span class="composer__number">{choice.label}</span>
                {choice.glimpse !== "" && <q>{choice.glimpse}</q>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pendingInline !== null && inlineTrigger !== undefined && (inlineMatches.length > 0 || inlineCreate) && (
        // An extension's list, drawn as the `#` list is. BO_0310_011
        <ul class="block-command__references composer__references" aria-label={`Choose after ${pendingInline.character}`} data-inline-trigger-list={pendingInline.character}>
          {inlineMatches.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                data-inline-trigger-option={entry.id}
                // The block keeps its caret, as a reference's option does.
                preventdefault:mousedown
                onClick$={() => chooseTrigger$(pendingInline.character, entry)}
              >
                <span class="composer__number">{entry.label}</span>
                {entry.detail !== undefined && entry.detail !== "" && <q>{entry.detail}</q>}
              </button>
            </li>
          ))}
          {inlineCreate && (
            <li key="create">
              <button type="button" data-inline-trigger-create preventdefault:mousedown onClick$={() => createTrigger$(pendingInline.character, pendingInline.typed)}>
                <Icon name="plus" />
                <span class="composer__number">{`${inlineTrigger.createLabel} “${pendingInline.typed.trim()}”`}</span>
              </button>
            </li>
          )}
        </ul>
      )}
      {files.attachNotice !== null && (
        <p class="block-command__notice" role="status" data-attach-refusal>
          {files.attachNotice}
        </p>
      )}
      {notice.value !== null && (
        <p class="block-command__notice" role="status" data-block-send-refusal>
          {notice.value}
        </p>
      )}
    </div>
  );
});
