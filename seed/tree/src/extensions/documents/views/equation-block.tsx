import { $, component$, useSignal, type QRL } from "@builder.io/qwik";

import type { EquationBlockView } from "../server/assemble";
import { EquationPopover, type EquationDraft } from "./equation-popover";

/**
 * A display equation in a document (`BO_0290_014`).
 *
 * **It arrives already set.** The markup is typeset on the server and travels
 * in the response (`server/assemble.ts`), so the browser never draws a
 * placeholder, never waits on a renderer and never resizes the block once the
 * page is live — which is the whole of the requirement that an equation must
 * not move the text around it. Nothing here imports MathJax: the type comes
 * from the assembler and the markup comes with the block.
 *
 * Like a divider and a picture it carries no authored text and takes no text
 * editor; the grip, the drag, the standing, the card and the chip come with
 * the row. Editing is the popover, which is why the source never appears in
 * the flow.
 */
export const EquationBlock = component$<{
  block: EquationBlockView;
  /** Editing the equation, when the reader may: a press opens the popover and
   * closing it saves. Absent, the block is read-only — a proposal's face, a
   * change document's member. `BO_0290_016` */
  revise$?: QRL<(blockId: string, draft: EquationDraft) => void> | undefined;
}>(({ block, revise$ }) => {
  const editing = useSignal(false);

  /**
   * A press on the equation opens the panel.
   *
   * **The handler sits on the equation, not on the block**, so that a press
   * inside the panel never travels through it. Deciding from the DOM instead
   * — ignoring a press that came from within the panel — does not work: by the
   * time this handler runs, closing has already removed the panel, so the
   * press looks like one on the equation and Done reopens what it just closed.
   * Structure settles it where a guard could not.
   */
  const open$ = $(() => {
    if (revise$ !== undefined) editing.value = true;
  });

  /** The panel stands beside the equation, so what is being edited never
   * moves under the person editing it. */
  const popover =
    editing.value && revise$ !== undefined ? (
      <EquationPopover
        key={block.revisionId}
        draft={{ tex: block.tex, caption: block.caption, numbered: block.numbered }}
        block={true}
        save$={$((draft: EquationDraft) => {
          void revise$(block.blockId, draft);
        })}
        close$={$(() => {
          editing.value = false;
        })}
      />
    ) : null;
  // The engine could not read the TeX. The block owns this presentation, so
  // one shape covers unsupported syntax, a parse error and an engine that
  // never ran: the source as it was written, with one restrained sentence.
  // Nothing is repaired and nothing is guessed. BO_0163's rule.
  if (block.svg === undefined) {
    return (
      <div class="equation-block equation-block--unset" data-equation-unset>
        <div class="equation-block__set" data-equation-press onClick$={open$}>
          <pre class="equation-block__source">{block.tex}</pre>
          <p class="equation-block__failure">
            {block.failure ?? "This equation could not be set."}
          </p>
        </div>
        {block.caption !== undefined && (
          <p class="equation-block__caption">{block.caption}</p>
        )}
        {popover}
      </div>
    );
  }

  return (
    <div class="equation-block" data-equation>
      <div class="equation-block__set" data-equation-press onClick$={open$}>
        {/* The equation scrolls inside its own block rather than widening the
            page, so a long one stays usable at phone width. */}
        <div
          class="equation-block__body"
          role="math"
          aria-label={block.tex}
          dangerouslySetInnerHTML={block.svg}
        />
        {/* The number stands outside the scrolling box, so a long equation
            never scrolls its own number out of sight. It is the document's
            order, resolved on every read and stored nowhere. */}
        {block.number !== undefined && (
          <span class="equation-block__number" data-equation-number={block.number}>
            ({block.number})
          </span>
        )}
      </div>
      {block.caption !== undefined && (
        <p class="equation-block__caption">{block.caption}</p>
      )}
      {popover}
    </div>
  );
});
