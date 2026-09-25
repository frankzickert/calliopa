import { $, component$, useSignal, useTask$, type QRL } from "@builder.io/qwik";

import type { CodeBlockView } from "../server/assemble";
import { lineCount, lineNumbersFrom } from "../lib/code-lines";
import { CODE_LANGUAGES } from "../lib/code-languages";
import { FigureCaption, type SetFigure } from "./figure-caption";
import { paintCode } from "./highlight-client";

/**
 * Code in a document (`BO_0289_018`, `BO_0296_018`, `BO_0302_006`): the
 * source typed in place in a monospace field that grows with it, the
 * language beside it, the source drawn in its language's colours — while
 * reading, from the markup the read set, and while writing, painted behind
 * the field — and, while the document numbers its code, a gutter of line
 * numbers beside it. It carries no runs and no text editor; the grip, the
 * drag and the chip come with the row as they do for a table.
 *
 * **A textarea cannot carry colour**, so the writing view is two layers: a
 * `<pre>` painted from the same characters, and the field above it with its
 * text transparent and its caret and selection kept. The two share every
 * metric — font, size, padding, line height, tab size — and the paint follows
 * the field's horizontal scroll, because a single pixel of disagreement is a
 * caret that sits beside the letter it is on. The paint holds the source
 * character for character, which `code-block.test.ts` pins.
 *
 * **The numbers are a gutter, not a rewrite of the markup.** The
 * highlighter's spans cross line breaks and the paint's text must stay the
 * field's character for character, so the numbers stand in a column of
 * their own left of the source, one per source line from the block's
 * `firstLine`, sharing the source's face and line height so each number
 * sits on its line's baseline. The column serves both shapes and is not
 * text: it is hidden from assistive technology and from selection, so a
 * block copied out pastes as its source alone.
 *
 * A settled edit — the field left, or Escape — lands as one `reviseCode` on
 * the block's base revision, the whole block, since code is one block
 * revised whole; while it is on its way the block says so
 * (`data-code-sending`), which is what the send control beside it waits for
 * before it runs, so what runs is what was typed. Whether the block continues
 * its numbering from the code block above it is a write of its own
 * (`BO_0302_008`), never part of the revise. Running the code is not this
 * view's: the `code` extension draws the send in the `run` place below the
 * source.
 */

/** What a revise answers: nothing, or the refusal in words. */
export type ReviseCode = QRL<(blockId: string, baseRevisionId: string, source: string, language: string | undefined) => Promise<string | null>>;

/** What setting the continuation answers: nothing, or the refusal in words. */
export type ContinueCode = QRL<(blockId: string, baseRevisionId: string, continues: boolean) => Promise<string | null>>;

/** Told the block's line count as it is typed, so the blocks below re-number. */
export type ReportCodeLines = QRL<(blockId: string, count: number) => void>;

/** The characters HTML reads as markup, escaped, so plain source paints as
 * itself where no markup was set. */
const escaped = (text: string): string => text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

export const CodeBlock = component$<{
  block: CodeBlockView;
  /** Whether the reader may edit it: a proposed code block is drawn as it is. */
  editable: boolean;
  /** Whether the document numbers its code (`BO_0302_007`): the gutter is
   * drawn only then, and the block is laid out as before without it. */
  numbered?: boolean;
  /** Where the numbering starts, resolved by the editor over the document
   * and what is typed (`BO_0302_006`); absent, the block's own from the
   * read, which a proposal's row and a stale row fall back to. */
  firstLine?: number | undefined;
  /** The listing's number from the read's map (`BO_0303_011`), never read
   * off the block, which the row hands over once. */
  number?: number | undefined;
  /** The caption line's command while the document is read; absent, a
   * caption is drawn as words and a proposed block draws its label alone. */
  caption$?: SetFigure | undefined;
  revise$?: ReviseCode;
  continue$?: ContinueCode;
  lines$?: ReportCodeLines;
}>(({ block, editable, numbered, firstLine, number, caption$, revise$, continue$, lines$ }) => {
  const source = useSignal(block.source);
  const language = useSignal(block.language ?? "");
  const revisionId = useSignal(block.revisionId);
  /** The colours drawn: the read's markup until the source changes under the
   * caret, then what the engine paints for what is typed. */
  const markup = useSignal<string | null>(block.markup ?? null);
  const failure = useSignal<string | null>(null);
  const sending = useSignal(false);
  /** Whether the continuation is being written: a second press while it is
   * on its way is not a second write. */
  const switching = useSignal(false);

  // A new revision read back is the code now; a draft of an older one is
  // not kept over it.
  useTask$(({ track }) => {
    const revised = track(() => block.revisionId);
    if (revised !== revisionId.value) {
      revisionId.value = revised;
      source.value = block.source;
      language.value = block.language ?? "";
      markup.value = block.markup ?? null;
    }
  });

  /** Repaints the overlay for what is typed now; a paint for a source that
   * moved on while the engine worked is dropped, never drawn late. */
  const repaint$ = $(async () => {
    const painted = { source: source.value, language: language.value };
    const value = await paintCode(painted.source, painted.language);
    if (source.value === painted.source && language.value === painted.language) markup.value = value;
  });

  const commit$ = $(async () => {
    if (revise$ === undefined) return;
    if (source.value === block.source && language.value === (block.language ?? "")) return;
    sending.value = true;
    failure.value = await revise$(block.blockId, block.revisionId, source.value, language.value.trim() === "" ? undefined : language.value.trim());
    sending.value = false;
  });

  const toggleContinues$ = $(async () => {
    if (continue$ === undefined || switching.value) return;
    switching.value = true;
    try {
      // The press takes the focus from the field, whose settle may be on its
      // way; it lands first, so the flag is written on the revision the
      // settle made rather than beside it.
      for (let waited = 0; sending.value && waited < 500; waited++) await new Promise((resolve) => setTimeout(resolve, 20));
      failure.value = await continue$(block.blockId, block.revisionId, block.continues !== true);
    } finally {
      switching.value = false;
    }
  });

  /** Tells the editor the line count as typed, once per change of it. */
  const reportLines$ = $(() => {
    if (lines$ !== undefined) void lines$(block.blockId, lineCount(source.value));
  });

  const writable = editable && revise$ !== undefined;
  const painted = markup.value ?? escaped(source.value);
  const languages = `code-languages-${block.blockId}`;
  // `list` names the datalist; Qwik's input typing does not know it, so it
  // is spread in rather than written as an attribute.
  const offering = { list: languages };
  // The gutter: one number per line of what is drawn now — the source as
  // typed while writing, the block's as read otherwise — from where the read
  // says the block starts. As wide as its longest number, so the code does
  // not move as the block grows from nine lines to ten. BO_0302_006
  const startsAt = firstLine ?? block.firstLine ?? 1;
  const numbers = numbered === true ? lineNumbersFrom(startsAt, lineCount(source.value)) : null;
  const gutter =
    numbers === null ? null : (
      <pre
        class="code-block__source code-block__gutter"
        aria-hidden="true"
        data-code-gutter
        data-code-first-line={String(startsAt)}
        style={{ "--code-gutter-digits": String(String(numbers[numbers.length - 1] ?? 1).length) }}
      >
        {numbers.join("\n")}
      </pre>
    );
  return (
    <figure
      class="code-block"
      data-code-block={block.blockId}
      data-code-editable={writable ? "true" : undefined}
      data-code-sending={sending.value ? "true" : undefined}
      data-code-language={language.value === "" ? undefined : language.value}
      data-code-coloured={markup.value === null ? undefined : "true"}
      data-code-numbered={numbers === null ? undefined : "true"}
      data-code-continues={block.continues === true ? "true" : undefined}
    >
      <div class="code-block__head">
        {/* Whether the block continues its numbering from the code block
            above it (BO_0302_008): the reader's to set while the block is
            writable, whether or not the document draws the numbers; on a
            proposal's chip row a word says it is set. */}
        {writable && continue$ !== undefined ? (
          <button
            type="button"
            class="code-block__continue"
            data-code-continue
            aria-pressed={block.continues === true ? "true" : "false"}
            aria-busy={switching.value ? "true" : undefined}
            disabled={switching.value}
            aria-label={block.continues === true ? "Continue numbering: on, this block counts on from the code block above it" : "Continue numbering: off, this block starts at line one"}
            onClick$={toggleContinues$}
          >
            Continue numbering
          </button>
        ) : block.continues === true ? (
          <span class="code-block__continue code-block__continue--shown" data-code-continue-shown>
            continues
          </span>
        ) : null}
        {writable ? (
          <>
            <input
              class="code-block__language"
              data-code-language-input
              aria-label="Language"
              placeholder="language"
              {...offering}
              value={language.value}
              onInput$={(_: Event, element: HTMLInputElement) => {
                language.value = element.value;
                void repaint$();
              }}
              onChange$={commit$}
            />
            {/* The languages the highlighter knows, offered; a word not among
                them is still typed and kept. BO_0296_019 */}
            <datalist id={languages} data-code-languages>
              {CODE_LANGUAGES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
        ) : (
          <span class="code-block__language" data-code-language-shown>
            {language.value}
          </span>
        )}
      </div>
      <div class="code-block__body">
        {gutter}
        {writable ? (
          <div class="code-block__field" data-code-field>
            <pre class="code-block__source code-block__paint" aria-hidden="true" data-code-paint>
              <code dangerouslySetInnerHTML={painted} />
            </pre>
            <textarea
              class="code-block__source code-block__input"
              data-code-source
              aria-label="Code"
              spellcheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={Math.max(2, source.value.split("\n").length)}
              value={source.value}
              onInput$={(_: Event, element: HTMLTextAreaElement) => {
                source.value = element.value;
                // The field grows with the code rather than scrolling inside it.
                element.style.height = "auto";
                element.style.height = `${element.scrollHeight}px`;
                void repaint$();
                void reportLines$();
              }}
              onScroll$={(_: Event, element: HTMLTextAreaElement) => {
                // A long line scrolls the field sideways under the caret; the
                // paint follows, so the colour stays under the letters.
                const paint = element.previousElementSibling;
                if (paint instanceof HTMLElement) paint.scrollLeft = element.scrollLeft;
              }}
              onChange$={commit$}
              onKeyDown$={(event: KeyboardEvent, element: HTMLTextAreaElement) => {
                // Tab indents rather than leaving the field; Escape settles the edit.
                if (event.key === "Tab") {
                  event.preventDefault();
                  const start = element.selectionStart;
                  element.setRangeText("    ", start, element.selectionEnd, "end");
                  source.value = element.value;
                  void repaint$();
                  void reportLines$();
                }
                if (event.key === "Escape") element.blur();
              }}
            />
          </div>
        ) : (
          <pre class="code-block__source code-block__source--read" data-code-source>
            <code dangerouslySetInnerHTML={painted} />
          </pre>
        )}
      </div>
      {failure.value !== null && (
        <p class="code-block__failure" data-code-failure role="alert">
          {failure.value}
        </p>
      )}
      {/* A listing's caption line (`BO_0303_011`): *Listing 2.* when the
          block is numbered, then its caption — a field while the document
          is read, the words alone otherwise, nothing when the block has
          neither and cannot be captioned here. */}
      <FigureCaption kind="listing" blockId={block.blockId} number={number} numbered={block.numbered} caption={block.caption} caption$={caption$} />
    </figure>
  );
});
