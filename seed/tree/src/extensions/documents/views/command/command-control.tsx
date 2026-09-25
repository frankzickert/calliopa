import { $, component$, useContext, useSignal, useVisibleTask$, type QRL } from "@builder.io/qwik";

import { AgentMenu } from "~/components/shell/agent-menu";
import { SpeedToggle } from "~/components/shell/speed-toggle";
import { AttachButton, AttachmentChips } from "~/components/shell/command-attachments";
import { Icon } from "~/components/shell/icons";
import { ReferenceChips } from "~/components/shell/reference-chips";
import { ViewBridgeContext, type SentCommand } from "~/components/shell/view-bridge";
import { readyDescriptors, stillUploading, uploadingNames, type AttachmentHolder } from "~/lib/attachments";
import { DOCUMENT_KIND, type AttachmentDescriptor, type RevealTarget } from "~/lib/command-target";
import { pendingBlockReference, pendingReference, referenceMatches } from "~/lib/command-typeahead";
import { replaceRange, replaceRangeWithAtom, runsPoints, type Run } from "~/lib/runs";
import { BlockDecorations } from "../decorations";
import { MarkingContext } from "../marking/use-marking";
import { matchingChoices, type ReferenceChoice } from "../../lib/reference-choices";
import type { EditorState } from "../block-editor";

/**
 * The command control on the block being edited, or on the prompt pointed
 * from: the agent, *Point from this block*, *Attach files*, and *Send* with a
 * caret offering *Send, keep as content*, on the block's bottom border, the
 * line proposals use. What the command carries stands as chips on the same
 * line. BO_0267_012
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

export const CommandControl = component$<{
  documentId: string;
  blockId: string;
  editor: EditorState;
  /** Whether the reader is pointing from this block. */
  pointing: boolean;
  send$: QRL<(blockId: string, asPrompt: boolean, attachments: readonly AttachmentDescriptor[]) => Promise<SentCommand>>;
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
}>(({ documentId, blockId, editor, pointing, send$, editRuns$, resume$, files, references }) => {
  const bridge = useContext(ViewBridgeContext);
  const { store: marking, point$, toggleReference$ } = useContext(MarkingContext);
  const notice = useSignal<string | null>(null);
  const menu = useSignal(false);

  /**
   * What the next press would cost, asked again whenever the sender or one of
   * its axes changes (`BO_0279_009`). Free — a quote is the generator's own
   * dry run — and held back a moment, because turning a control is a stream of
   * changes and only the last one matters.
   */
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const sender = track(() => bridge.agents.agent);
    const chosen = track(() => JSON.stringify(bridge.agents.options));
    if (sender === null) return;
    void chosen;
    const held = setTimeout(() => void bridge.quoteSend$(documentId, blockId), 400);
    cleanup(() => clearTimeout(held));
  });

  const send = $(async (asPrompt: boolean) => {
    menu.value = false;
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
  });

  /**
   * Shows what a chip points at. In this document, the view reveals it. In
   * another document (`BO_0304_009`), the shell brings that document forward
   * first — its open tab, or a new one — and the reveal is aimed there: the
   * view that mounts acts on a reveal aimed at its document that no view has
   * consumed. A document marked whole is brought forward and nothing more.
   */
  const reveal$ = $(async (target: RevealTarget) => {
    if (target.kind === "document") {
      await bridge.openTarget$({ kind: DOCUMENT_KIND, itemId: target.document, title: target.documentTitle ?? target.document });
      return;
    }
    const where = target.kind === "takeBack" || target.document === undefined ? documentId : target.document;
    if (where !== documentId && target.kind !== "takeBack") {
      await bridge.openTarget$({ kind: DOCUMENT_KIND, itemId: where, title: target.documentTitle ?? where });
    }
    bridge.reveal.itemId = where;
    bridge.reveal.target = target;
    bridge.reveal.seq += 1;
  });

  const choose$ = $(async (number: number) => {
    if (editor.blockId !== blockId) return;
    const pending = pendingAt(editor.runs, editor.start);
    if (pending === null) return;
    const written = `#${number} `;
    const runs = replaceRange(editor.runs, pending.start, editor.end, written);
    const caret = pending.start + [...written].length;
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
    const held = marking.marking.references.find((reference) => reference.kind === "block" && reference.blockId === target && reference.document === undefined);
    const number = held?.number ?? marking.marking.next;
    if (held === undefined) await toggleReference$(target);
    const written = `#${number} `;
    const runs = replaceRange(editor.runs, pending.start, editor.end, written);
    const caret = pending.start + [...written].length;
    await editRuns$(runs, caret, caret);
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

  return (
    // Its presses are its own: a press here reaching the row would read as a
    // press on the block — marking it, or ending pointing from it.
    <div class="block-command" data-block-command={blockId} role="group" aria-label="Command" stoppropagation:click>
      {(matches.length > 0 || blockMatches.length > 0) && (
        // One list: the prompt's marks by number first, then the blocks of
        // the document it may refer to or mark. BO_0300_005 BO_0304_016
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
      <div class="block-command__line" data-block-command-controls>
        {/* One chip holds the whole line: the agent, pointing and attaching,
            then what the command carries, then Send and its caret at the end.
            Every button is one size. BO_0267_027 BO_0267_028 */}
        <AgentMenu
          runtimes={bridge.agents.runtimes}
          value={bridge.agents.agent}
          disabled={sending}
          onChoose$={bridge.chooseAgent$}
          refresh$={bridge.refreshAgents$}
          options={bridge.agents.options}
          onOption$={bridge.chooseOption$}
        />
        <SpeedToggle value={bridge.agents.speed} disabled={sending} onChoose$={bridge.chooseSpeed$} />
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
        />
        <AttachmentChips holder={files} />
        <ReferenceChips pointing={marking.report} onReveal$={reveal$} />
        <span class="block-command__send">
          <button
            type="button"
            class="block-command__send-main"
            data-block-send
            aria-label="Send as prompt"
            // What this press would cost, on the thing that spends
            // (`BO_0279_009`). Quoted as the reader turns a control, so the
            // number is current the moment they look rather than after a wait;
            // an agent, or a model nothing can quote, says only what it did.
            title={bridge.agents.cost === "" ? `Send as prompt · ${sendShortcut()}` : `Send as prompt · ${sendShortcut()} · about ${bridge.agents.cost}`}
            disabled={sending}
            onClick$={() => send(true)}
          >
            <Icon name="play" />
          </button>
          <button
            type="button"
            class="block-command__send-more"
            data-block-send-more
            aria-label="More ways to send"
            title="More ways to send"
            aria-haspopup="menu"
            aria-expanded={menu.value}
            disabled={sending}
            onClick$={() => (menu.value = !menu.value)}
          >
            <Icon name="caret-down" />
          </button>
          {menu.value && (
            <span class="block-command__menu" role="menu">
              <button type="button" role="menuitem" data-block-send-keep onClick$={() => send(false)}>
                Send, keep as content
              </button>
            </span>
          )}
        </span>
      </div>
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
