import { $, component$, useSignal, useTask$, type QRL } from "@builder.io/qwik";

import type { CodeBlockView } from "../server/assemble";

/**
 * Code in a document (`BO_0289_018`): the source typed in place in a
 * monospace field that grows with it, and the language beside it. It carries
 * no runs and no text editor; the grip, the drag and the chip come with the
 * row as they do for a table.
 *
 * A settled edit — the field left, or Escape — lands as one `reviseCode` on
 * the block's base revision, the whole block, since code is one block
 * revised whole; while it is on its way the block says so
 * (`data-code-sending`), which is what the send control beside it waits for
 * before it runs, so what runs is what was typed. Running the code is not
 * this view's: the `code` extension draws the send in the `run` place below
 * the source.
 */

/** What a revise answers: nothing, or the refusal in words. */
export type ReviseCode = QRL<(blockId: string, baseRevisionId: string, source: string, language: string | undefined) => Promise<string | null>>;

export const CodeBlock = component$<{
  block: CodeBlockView;
  /** Whether the reader may edit it: a proposed code block is drawn as it is. */
  editable: boolean;
  revise$?: ReviseCode;
}>(({ block, editable, revise$ }) => {
  const source = useSignal(block.source);
  const language = useSignal(block.language ?? "");
  const revisionId = useSignal(block.revisionId);
  const failure = useSignal<string | null>(null);
  const sending = useSignal(false);

  // A new revision read back is the code now; a draft of an older one is
  // not kept over it.
  useTask$(({ track }) => {
    const revised = track(() => block.revisionId);
    if (revised !== revisionId.value) {
      revisionId.value = revised;
      source.value = block.source;
      language.value = block.language ?? "";
    }
  });

  const commit$ = $(async () => {
    if (revise$ === undefined) return;
    if (source.value === block.source && language.value === (block.language ?? "")) return;
    sending.value = true;
    failure.value = await revise$(block.blockId, block.revisionId, source.value, language.value.trim() === "" ? undefined : language.value.trim());
    sending.value = false;
  });

  const writable = editable && revise$ !== undefined;
  return (
    <figure
      class="code-block"
      data-code-block={block.blockId}
      data-code-editable={writable ? "true" : undefined}
      data-code-sending={sending.value ? "true" : undefined}
      data-code-language={language.value === "" ? undefined : language.value}
    >
      <div class="code-block__head">
        {writable ? (
          <input
            class="code-block__language"
            data-code-language-input
            aria-label="Language"
            placeholder="language"
            value={language.value}
            onInput$={(_: Event, element: HTMLInputElement) => (language.value = element.value)}
            onChange$={commit$}
          />
        ) : (
          <span class="code-block__language" data-code-language-shown>
            {language.value}
          </span>
        )}
      </div>
      {writable ? (
        <textarea
          class="code-block__source"
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
          }}
          onChange$={commit$}
          onKeyDown$={(event: KeyboardEvent, element: HTMLTextAreaElement) => {
            // Tab indents rather than leaving the field; Escape settles the edit.
            if (event.key === "Tab") {
              event.preventDefault();
              const start = element.selectionStart;
              element.setRangeText("    ", start, element.selectionEnd, "end");
              source.value = element.value;
            }
            if (event.key === "Escape") element.blur();
          }}
        />
      ) : (
        <pre class="code-block__source code-block__source--read" data-code-source>
          <code>{source.value}</code>
        </pre>
      )}
      {failure.value !== null && (
        <p class="code-block__failure" data-code-failure role="alert">
          {failure.value}
        </p>
      )}
    </figure>
  );
});
