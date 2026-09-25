import { component$, type QRL } from "@builder.io/qwik";

import { type NumberedKind, numberLabel } from "../lib/figure-label";

/**
 * Sets a picture's or an output's caption and its number's ask, or a table's
 * ask, on the block's base revision (`BO_0295_008`): one `setFigure` command.
 * Answers the refusal in words, or nothing.
 */
export type SetFigure = QRL<
  (blockId: string, change: { readonly caption?: string | undefined; readonly numbered?: boolean | undefined }) => Promise<string | null>
>;

/**
 * A figure's caption line (`BO_0295_010`): *Figure 3.* when the block is
 * numbered, then its caption — a field while the document is read and the row
 * hands over the command, the words alone otherwise. A number needs no
 * caption, so a numbered figure without one draws its label alone; a block
 * with neither draws nothing unless it can be captioned here. A code block's
 * caption line is the same, labelled *Listing 2.* (`BO_0303_011`).
 */
export const FigureCaption = component$<{
  blockId: string;
  /** What the number is labelled as; a figure unless said otherwise. */
  kind?: NumberedKind | undefined;
  number?: number | undefined;
  numbered?: boolean | undefined;
  caption?: string | undefined;
  caption$?: SetFigure | undefined;
}>(({ blockId, kind, number, numbered, caption, caption$ }) => {
  const words = caption ?? "";
  if (caption$ === undefined && words === "" && number === undefined) return null;
  return (
    <figcaption class="figure-caption" data-figure-caption={blockId}>
      {number !== undefined && (
        <span class="figure-caption__label" data-figure-number={number}>
          {numberLabel(kind ?? "figure", number)}
        </span>
      )}
      {caption$ !== undefined ? (
        <input
          class="figure-caption__input"
          data-figure-caption-input
          aria-label="Caption"
          placeholder="Caption"
          value={words}
          onChange$={(_: Event, element: HTMLInputElement) => {
            if (element.value.trim() === words) return;
            void caption$(blockId, { caption: element.value, numbered: numbered === true });
          }}
        />
      ) : (
        words !== "" && <span class="figure-caption__words">{words}</span>
      )}
    </figcaption>
  );
});
