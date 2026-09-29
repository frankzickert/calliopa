import { component$, type QRL } from "@builder.io/qwik";
import type { Run } from "~/lib/runs";

import { type NumberedKind, numberLabel } from "../lib/figure-label";

const captionRunsFrom = (root: HTMLElement): Run[] => {
  const runs: Run[] = [];
  const visit = (node: Node, inheritedLink?: string): void => {
    if (node.nodeType === 3) {
      const text = node.textContent ?? "";
      if (text !== "") runs.push({ text, ...(inheritedLink === undefined ? {} : { link: inheritedLink }) });
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement;
    const link = element.tagName === "A" ? element.getAttribute("href") ?? inheritedLink : inheritedLink;
    for (const child of Array.from(element.childNodes)) visit(child, link);
  };
  for (const child of Array.from(root.childNodes)) visit(child);
  return runs;
};

/** Sets a figure caption, linked image caption runs, or the number ask. */
export type SetFigure = QRL<
  (blockId: string, change: { readonly caption?: string | undefined; readonly captionRuns?: readonly Run[] | undefined; readonly numbered?: boolean | undefined }) => Promise<string | null>
>;

/** A figure caption and its number; image run captions keep editable links. */
export const FigureCaption = component$<{
  blockId: string;
  kind?: NumberedKind | undefined;
  number?: number | undefined;
  numbered?: boolean | undefined;
  caption?: string | undefined;
  captionRuns?: readonly Run[] | undefined;
  caption$?: SetFigure | undefined;
}>(({ blockId, kind, number, numbered, caption, captionRuns, caption$ }) => {
  const words = caption ?? captionRuns?.map((run) => run.text).join("") ?? "";
  if (caption$ === undefined && words === "" && number === undefined) return null;
  const linkedWords = captionRuns?.map((run, index) => run.link !== undefined
    ? <a key={index} href={run.link} target="_blank" rel="noopener noreferrer">{run.text}</a>
    : <span key={index}>{run.text}</span>);
  return (
    <figcaption class="figure-caption" data-figure-caption={blockId}>
      {number !== undefined && <span class="figure-caption__label" data-figure-number={number}>{numberLabel(kind ?? "figure", number)}</span>}
      {captionRuns !== undefined && caption$ !== undefined ? (
        <>
          <span
            class="figure-caption__words"
            data-caption-runs={blockId}
            contentEditable="true"
            role="textbox"
            aria-label="Caption"
            onBlur$={(_, element) => void caption$(blockId, { captionRuns: captionRunsFrom(element), numbered: numbered === true })}
          >{linkedWords}</span>
          <button
            type="button"
            class="figure-caption__link"
            aria-label="Add or edit caption link"
            onMouseDown$={(event) => event.preventDefault()}
            onClick$={(_, button) => {
              const editor = button.parentElement?.querySelector<HTMLElement>("[data-caption-runs]");
              const selected = window.getSelection()?.anchorNode;
              const currentAnchor = selected instanceof Element ? selected.closest("a") : selected?.parentElement?.closest("a");
              const href = window.prompt("Link address", currentAnchor?.getAttribute("href") ?? "");
              if (editor === null || editor === undefined || href === null || href.trim() === "") return;
              document.execCommand("createLink", false, href.trim());
              void caption$(blockId, { captionRuns: captionRunsFrom(editor), numbered: numbered === true });
            }}
          >Link</button>
        </>
      ) : captionRuns !== undefined ? (
        <span class="figure-caption__words" data-caption-runs={blockId}>{linkedWords}</span>
      ) : caption$ !== undefined ? (
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
      ) : words !== "" ? <span class="figure-caption__words">{words}</span> : null}
    </figcaption>
  );
});
