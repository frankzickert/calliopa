import { component$, useContext } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";

import { citationKey, type Citation, type Mark, type TextRole } from "~/lib/runs";

import { citeLabel } from "../lib/citation-label";
import { referenceLabel } from "../lib/figure-label";
import { CitedWorksContext } from "./cited-works";

/**
 * How a text block's words are drawn, shared by the block editor's rows and
 * the proposed changes drawn as blocks beside them (`BO_0233_004`), so a
 * proposal reads in the typography of the block it would become. Moved out of
 * `block-editor.tsx` with `BO_0233`.
 */

/**
 * Reading and editing use the same element, so the role decides the tag once.
 *
 * Levels start at `h3` because the page's `h1` is the application and this
 * view's own title is the `h2` beneath it: a document's headings are real
 * headings, sitting below the title that names them rather than competing with
 * it, and the outline skips no level on the way down.
 */
export type BlockTag = "p" | "h3" | "h4" | "h5" | "blockquote";

export const ROLE_TAG: Readonly<Record<TextRole, BlockTag>> = {
  paragraph: "p",
  h1: "h3",
  h2: "h4",
  h3: "h5",
  quote: "blockquote",
  // An abstract is a paragraph of its own kind, set apart by the stylesheet
  // through its role. BO_0293_014
  abstract: "p",
};

/**
 * A run's marks as real elements, peeled one at a time.
 *
 * Nesting rather than one span with classes: `strong` and `em` mean something
 * to a screen reader that a styled span does not, and the reading presentation
 * is the one a reader actually reads.
 */
export const Marked = component$<{
  text: string;
  marks: readonly Mark[];
  link?: string | undefined;
  /** Mathematics set in the line: the text is its TeX, and `svg` is what the
   * read typeset it as. `BO_0290_015` */
  math?: boolean | undefined;
  svg?: string | undefined;
  /** A reference to a numbered equation, drawn as that equation's current
   * number — or, when its equation is gone from the document, as words saying
   * so rather than as a stale number. */
  equationRef?: string | undefined;
  number?: number | undefined;
  /** A citation of a work of the bibliography, drawn as the work's number in
   * this document, or as words when its work is gone. `BO_0291_025` */
  cite?: Citation | undefined;
  citeNumber?: number | undefined;
  citeMissing?: boolean | undefined;
  /** A reference to a numbered figure or table, drawn as its current number,
   * or as words when it is gone. `BO_0295_012` */
  figureRef?: string | undefined;
  tableRef?: string | undefined;
  refNumber?: number | undefined;
}>(({ text, marks, link, math, svg, equationRef, number, cite, citeNumber, citeMissing, figureRef, tableRef, refNumber }) => {
  // An atom stands for one thing rather than for its characters, so it is
  // drawn before the marks are peeled: a mark means nothing over an equation.
  if (cite !== undefined) {
    return <CitedRun work={cite.work} locator={cite.locator} fallback={citeLabel(cite, citeNumber, citeMissing === true)} missing={citeMissing === true} />;
  }
  if (figureRef !== undefined || tableRef !== undefined) {
    const kind = figureRef !== undefined ? "figure" : "table";
    return (
      <span
        class={`run-block-ref${refNumber === undefined ? " run-block-ref--missing" : ""}`}
        data-figure-ref={figureRef}
        data-table-ref={tableRef}
      >
        {referenceLabel(kind, refNumber)}
      </span>
    );
  }
  if (equationRef !== undefined) {
    return (
      <span class="run-equation-ref" data-equation-ref={equationRef}>
        {number === undefined ? "(equation gone)" : `(${number})`}
      </span>
    );
  }
  if (math === true) {
    if (svg === undefined || svg === "") {
      // Unset mathematics reads as its source rather than as a gap.
      return (
        <span class="run-math" data-math={text} data-math-unset>
          {text}
        </span>
      );
    }
    return (
      <span
        class="run-math"
        data-math={text}
        role="math"
        aria-label={text}
        dangerouslySetInnerHTML={svg}
      />
    );
  }
  if (link !== undefined) {
    return (
      <a href={link} class="run-link">
        <Marked text={text} marks={marks} />
      </a>
    );
  }
  const [first, ...rest] = marks;
  if (first === undefined) return <span class="run">{text}</span>;
  if (first === "bold") {
    return (
      <strong>
        <Marked text={text} marks={rest} />
      </strong>
    );
  }
  if (first === "italic") {
    return (
      <em>
        <Marked text={text} marks={rest} />
      </em>
    );
  }
  if (first === "strikethrough") {
    return (
      <s>
        <Marked text={text} marks={rest} />
      </s>
    );
  }
  return (
    <code>
      <Marked text={text} marks={rest} />
    </code>
  );
});

/**
 * A citation in reading, with its hover card (`BO_0291_026`): the pointer
 * over it, or focus from the keyboard, opens a card with the work as
 * *who (year) — title*, a control opening the work's page in the Sources
 * category, its DOI or its address, its PDF when the work holds one, and the
 * locator. Touch opens it on a tap, which focuses it. The card is drawn from
 * what the editor read of the bibliography; with no bibliography there is no
 * card and the number stands alone.
 */
const CitedRun = component$<{ work: string; locator?: string | undefined; fallback: string; missing: boolean }>(({ work, locator, fallback, missing }) => {
  const cited = useContext(CitedWorksContext, null);
  const bridge = useContext(ViewBridgeContext, null);
  const card = cited?.byWork[work];
  // The label in the document's style when the bibliography answered one;
  // the number otherwise, and the gone words always. BO_0291_030
  const styled = missing ? undefined : cited?.labels[citationKey({ work, ...(locator === undefined ? {} : { locator }) })];
  const label = styled ?? fallback;
  return (
    <span
      class={`run-cite${missing ? " run-cite--missing" : ""}`}
      data-cite-work={work}
      data-cite-locator={locator}
      // Focusable so the card opens from the keyboard and on a tap; set
      // unconditionally, since a spread makes the optimizer emit a key twice.
      tabIndex={0}
    >
      {label}
      {card !== undefined && (
        <span class="cite-card" role="tooltip" data-cite-card={work}>
          <span class="cite-card__line">{card.line}</span>
          {locator !== undefined && locator !== "" && <span class="cite-card__locator">{locator}</span>}
          <span class="cite-card__links">
            {bridge !== null && (
              <button
                type="button"
                class="cite-card__open"
                data-cite-open={work}
                onClick$={() => bridge.openTarget$({ kind: "bibliography:work", itemId: work, title: card.title })}
              >
                Open source
              </button>
            )}
            {card.doi !== undefined ? (
              <a href={`https://doi.org/${card.doi}`} target="_blank" rel="noopener" data-cite-doi>
                DOI
              </a>
            ) : card.url !== undefined ? (
              <a href={card.url} target="_blank" rel="noopener" data-cite-url>
                Link
              </a>
            ) : null}
            {card.file && (
              <a href={`/api/x/bibliography/works/${encodeURIComponent(work)}/file`} target="_blank" rel="noopener" data-cite-file>
                PDF
              </a>
            )}
          </span>
        </span>
      )}
    </span>
  );
});
