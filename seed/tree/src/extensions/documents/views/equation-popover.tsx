import {
  $,
  component$,
  useSignal,
  useTask$,
  type QRL,
} from "@builder.io/qwik";

/** What the popover is editing: an equation's source, and — for a block — its
 * caption and whether its author asks for a number. */
export interface EquationDraft {
  readonly tex: string;
  readonly caption?: string | undefined;
  readonly numbered?: boolean | undefined;
}

/**
 * The one editing surface for mathematics (`BO_0290_016`), block or inline.
 *
 * **It exists so the source never enters the text flow.** An equation is
 * always drawn typeset, in reading and while its block is edited alike; were
 * the TeX to take its place the moment someone edited it, the line would
 * reflow on entry and exit. So the source is edited beside the equation
 * instead of in it, and the equation under the panel never moves.
 *
 * The engine is loaded here and nowhere else in the browser: reading a
 * document draws markup the server already set, so a reader who never edits
 * never downloads MathJax.
 */
export const EquationPopover = component$<{
  draft: EquationDraft;
  /** A block equation carries a caption and a number; mathematics in a
   * sentence carries neither. */
  block: boolean;
  save$: QRL<(draft: EquationDraft) => void>;
  close$: QRL<() => void>;
}>(({ draft, block, save$, close$ }) => {
  const tex = useSignal(draft.tex);
  const caption = useSignal(draft.caption ?? "");
  const numbered = useSignal(draft.numbered === true);
  const preview = useSignal<string>("");
  const failure = useSignal<string>("");

  /**
   * The equation as it will be set, beside the source as it is typed.
   *
   * The engine arrives through a lazy import, so it is fetched the first time
   * someone edits mathematics and never for reading. A failure is shown as
   * the sentence it is — the source stays exactly as written, because
   * refusing to draw is not a reason to refuse to keep.
   */
  useTask$(async ({ track }) => {
    const source = track(() => tex.value);
    if (source.trim() === "") {
      preview.value = "";
      failure.value = "";
      return;
    }
    const { isTypeset, typeset } = await import("../lib/mathjax");
    const outcome = typeset(source, block);
    if (isTypeset(outcome)) {
      preview.value = outcome.svg;
      failure.value = "";
      return;
    }
    // Half-written TeX is unreadable by definition — `x^` on the way to
    // `x^2` — so the last equation that *did* set stays where it is and the
    // sentence stands under it. Blanking it would make the panel flash on
    // the way to every superscript. BO_0290_028
    failure.value = outcome.failure;
  });

  /**
   * Closing saves, as the editor's pause save does. An equation whose TeX
   * cannot be read is saved all the same: refusing would lose what the person
   * wrote, and the block draws unreadable source as itself.
   */
  const commit$ = $(() => {
    save$({
      tex: tex.value,
      ...(block ? { caption: caption.value, numbered: numbered.value } : {}),
    });
    close$();
  });

  return (
    <div
      class="equation-popover"
      data-equation-popover
      role="dialog"
      aria-label="Edit the equation"
      // Escape closes it, and closing saves. **No blanket preventdefault**
      // here: declaring one on the element cancels the default action of
      // every key it sees, which stops a character reaching the field at all
      // and breaks a dead key outright — a panel that will not take input.
      // Escape needs no preventing; nothing else acts on it. BO_0290_028
      onKeyDown$={(event) => {
        if (event.key === "Escape") void commit$();
      }}
    >
      <label class="equation-popover__label" for="equation-source">
        TeX
      </label>
      <textarea
        id="equation-source"
        class="equation-popover__source"
        data-equation-source
        rows={3}
        // The initial source, not the live signal: binding the signal back
        // into the value re-renders the field on every keystroke and puts
        // the caret back to the end, which reads as a field that will not
        // take input. The signal is what the preview and the save read.
        value={draft.tex}
        onInput$={(_, element) => {
          tex.value = element.value;
        }}
      />

      {/* The result beside the source, as it is typed. */}
      <div class="equation-popover__preview" data-equation-preview>
        {preview.value !== "" && <span dangerouslySetInnerHTML={preview.value} />}
        {/* Beneath the equation rather than in its place: what was set last
            stays visible while the source is half written. */}
        {failure.value !== "" && (
          <span class="equation-popover__failure" data-equation-failure>
            {failure.value}
          </span>
        )}
      </div>

      {block && (
        <>
          <label class="equation-popover__label" for="equation-caption">
            Caption
          </label>
          <input
            id="equation-caption"
            class="equation-popover__caption"
            data-equation-caption
            type="text"
            value={draft.caption ?? ""}
            onInput$={(_, element) => {
              caption.value = element.value;
            }}
          />
          <label class="equation-popover__number">
            <input
              type="checkbox"
              data-equation-numbered
              checked={draft.numbered === true}
              onChange$={(_, element) => {
                numbered.value = element.checked;
              }}
            />
            Number this equation
          </label>
        </>
      )}

      <button type="button" class="equation-popover__done" data-equation-done onClick$={commit$}>
        Done
      </button>
    </div>
  );
});
