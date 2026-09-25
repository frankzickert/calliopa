import { MARKS, isAtom, normalizeRuns, type Mark, type Run } from "~/lib/runs";

import { citeLabel } from "../lib/citation-label";
import { GONE_LABEL, referenceLabel } from "../lib/figure-label";
import { linePlace, type LinePlace } from "../lib/lines";

/**
 * The crossing between a run list and a live `contenteditable`.
 *
 * The model is authoritative in both directions: the element is painted from
 * runs, and what the browser leaves in the element after typing is read back
 * into runs. Nothing here decides what an edit means — that is `~/lib/runs` —
 * and nothing here talks to the graph.
 *
 * Positions crossing this boundary are character offsets, matching the run
 * model, so a selection and a split agree about where a caret sits even in text
 * outside the basic plane.
 */

const MARK_TAG: Readonly<Record<Mark, string>> = {
  bold: "strong",
  italic: "em",
  strikethrough: "s",
  code: "code",
};

const TAG_MARK = new Map<string, Mark>(
  MARKS.map((mark) => [MARK_TAG[mark].toUpperCase(), mark]),
);

/**
 * Mathematics and a reference to it inside the editing surface
 * (`BO_0290_015`).
 *
 * **They stay typeset while the block is edited.** Were the source to take an
 * equation's place the moment a reader put a caret in the sentence, the line
 * would reflow on every entry and exit — which is what the retired shell did,
 * forced there by Lexical, and what the popover exists to avoid.
 *
 * Each is painted as one element the browser must not edit, and the caret
 * steps over it because it holds exactly **one character**: an invisible
 * separator, which is what makes the DOM's own offsets agree with
 * `runsLength`, where an atom is one character too. Without that character
 * `range.toString()` would count an equation as nothing and every caret
 * position after it would be wrong.
 */
const ATOM_CHAR = "\u2063";
const MATH_ATTRIBUTE = "data-math";
const REFERENCE_ATTRIBUTE = "data-equation-ref";
const CITE_WORK_ATTRIBUTE = "data-cite-work";
const CITE_LOCATOR_ATTRIBUTE = "data-cite-locator";
const CITE_LABEL_ATTRIBUTE = "data-cite-label";
const FIGURE_REF_ATTRIBUTE = "data-figure-ref";
const TABLE_REF_ATTRIBUTE = "data-table-ref";
const BLOCK_REF_LABEL_ATTRIBUTE = "data-block-ref-label";
const BLOCK_REF_ATTRIBUTE = "data-block-ref";

/** What an atom is drawn from: the markup its source was set as, and the
 * number a reference resolves to. Both are the read's, since the browser does
 * not typeset while it reads. */
export interface AtomContent {
  readonly svgOf?: (tex: string) => string | undefined;
  readonly numberOf?: (blockId: string) => number | undefined;
  /** What a citation of this work is drawn as: its number in the document,
   * or that the work is gone (`BO_0291_025`). */
  readonly citationOf?: (work: string, locator?: string) => { readonly number?: number; readonly missing?: boolean; readonly label?: string } | undefined;
  /** The number a figure or a table reference resolves to (`BO_0295_012`). */
  readonly figureNumberOf?: (blockId: string) => number | undefined;
  readonly tableNumberOf?: (blockId: string) => number | undefined;
  /** What a reference to any block is drawn as (`BO_0300_007`): the label
   * the read resolved, or nothing when the block is outside the reading
   * order. */
  readonly referenceLabelOf?: (blockId: string) => string | undefined;
}

/** Paints one atom: the element the caret steps over, carrying what it stands
 * for so `runsFrom` can read it back without looking inside. */
function paintAtom(
  document: Document,
  entry: Run,
  content: AtomContent,
): HTMLElement {
  const element = document.createElement("span");
  element.setAttribute("contenteditable", "false");
  if (entry.math === true) {
    element.setAttribute(MATH_ATTRIBUTE, entry.text);
    element.className = "run-math";
    const markup = content.svgOf?.(entry.text);
    if (markup === undefined || markup === "") {
      // Unset mathematics reads as its source rather than as a gap, so a
      // sentence never loses what was written in it.
      element.setAttribute("data-math-unset", "");
      element.appendChild(document.createTextNode(entry.text));
    } else {
      element.setAttribute("role", "math");
      element.setAttribute("aria-label", entry.text);
      const holder = document.createElement("span");
      holder.innerHTML = markup;
      element.appendChild(holder);
    }
  } else if (entry.cite !== undefined) {
    element.setAttribute(CITE_WORK_ATTRIBUTE, entry.cite.work);
    if (entry.cite.locator !== undefined) element.setAttribute(CITE_LOCATOR_ATTRIBUTE, entry.cite.locator);
    const resolved = content.citationOf?.(entry.cite.work, entry.cite.locator);
    const missing = resolved?.missing === true;
    element.className = missing ? "run-cite run-cite--missing" : "run-cite";
    // The label is drawn from an attribute by the stylesheet, not as text:
    // text inside the atom would count towards the DOM's offsets, and every
    // caret position after a citation would be off by the label's length.
    element.setAttribute(CITE_LABEL_ATTRIBUTE, missing || resolved?.label === undefined ? citeLabel(entry.cite, resolved?.number, missing) : resolved.label);
  } else if (entry.figureRef !== undefined || entry.tableRef !== undefined) {
    // A figure or table reference (`BO_0295_012`), labelled from an attribute
    // as a citation is, so its words add nothing to the caret's offsets.
    const figure = entry.figureRef !== undefined;
    const target = (figure ? entry.figureRef : entry.tableRef) as string;
    element.setAttribute(figure ? FIGURE_REF_ATTRIBUTE : TABLE_REF_ATTRIBUTE, target);
    const number = figure ? content.figureNumberOf?.(target) : content.tableNumberOf?.(target);
    element.className = number === undefined ? "run-block-ref run-block-ref--missing" : "run-block-ref";
    element.setAttribute(BLOCK_REF_LABEL_ATTRIBUTE, referenceLabel(figure ? "figure" : "table", number));
  } else if (entry.blockRef !== undefined) {
    // A reference to any block (`BO_0300_007`), labelled from an attribute
    // as the two above are; gone when the read resolved nothing for it.
    element.setAttribute(BLOCK_REF_ATTRIBUTE, entry.blockRef);
    const label = content.referenceLabelOf?.(entry.blockRef);
    element.className = label === undefined ? "run-block-ref run-block-ref--missing" : "run-block-ref";
    element.setAttribute(BLOCK_REF_LABEL_ATTRIBUTE, label ?? GONE_LABEL);
  } else if (entry.equationRef !== undefined) {
    element.setAttribute(REFERENCE_ATTRIBUTE, entry.equationRef);
    element.className = "run-equation-ref";
    const number = content.numberOf?.(entry.equationRef);
    // A reference whose equation is gone says so in words. It is never a
    // stale number and never nothing at all.
    element.appendChild(
      document.createTextNode(number === undefined ? "(equation gone)" : `(${number})`),
    );
  }
  // The one character the caret counts. It goes last so a reader selecting
  // the atom selects the whole of it.
  element.appendChild(document.createTextNode(ATOM_CHAR));
  return element;
}

/** Paints a run list into an element, replacing whatever was there.
 *
 * An empty block still needs a line box or the caret has nowhere to sit, which
 * is what the trailing `<br>` is for; `runsFrom` skips it, so it never becomes
 * content. */
export function paintRuns(
  element: HTMLElement,
  runs: readonly Run[],
  atoms: AtomContent = {},
): void {
  // The element's own document: the page's in a browser, and the render
  // harness's where it has no global one (`BO_0233_009`).
  const document = element.ownerDocument;
  element.replaceChildren();
  for (const entry of runs) {
    if (isAtom(entry)) {
      element.appendChild(paintAtom(document, entry, atoms));
      continue;
    }
    let node: Node = document.createTextNode(entry.text);
    for (const mark of MARKS) {
      if (entry.marks?.includes(mark) === true) {
        const wrapper = document.createElement(MARK_TAG[mark]);
        wrapper.appendChild(node);
        node = wrapper;
      }
    }
    if (entry.link !== undefined) {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", entry.link);
      anchor.appendChild(node);
      node = anchor;
    }
    element.appendChild(node);
  }
  // A line break at the very end draws no line of its own until something
  // follows it, so a `<br>` holds the line the caret stands on. DO_0003_003
  //
  // An atom at the very end needs one for its own reason (`BO_0290_030`): it
  // is not editable, so with nothing after it the caret has nowhere to land
  // and a reader cannot type past a reference that ends a sentence. The
  // `<br>` is read back as nothing, as it already is.
  const last = runs[runs.length - 1];
  if (runs.length === 0 || last?.text.endsWith("\n") === true || (last !== undefined && isAtom(last))) {
    element.appendChild(document.createElement("br"));
  }
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** Reads an element's content back into runs. */
export function runsFrom(element: HTMLElement): Run[] {
  const runs: Run[] = [];

  const walk = (
    node: Node,
    marks: readonly Mark[],
    link: string | undefined,
  ): void => {
    // By node type rather than the globals `Node` and `HTMLElement`, which a
    // render harness does not install; a proposal reads a composition back
    // here too (`BO_0233_014`).
    if (node.nodeType === TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text !== "") {
        runs.push({
          text,
          ...(marks.length > 0 ? { marks: [...marks] } : {}),
          ...(link !== undefined ? { link } : {}),
        });
      }
      return;
    }
    if (node.nodeType !== ELEMENT_NODE || !("tagName" in node)) return;
    const element = node as HTMLElement;
    if (element.tagName === "BR") return;
    // An atom is read back from what it says it is, never from what is drawn
    // inside it: walking into one would read an equation's own markup as the
    // sentence's words. `BO_0290_015`
    const math = element.getAttribute(MATH_ATTRIBUTE);
    if (math !== null) {
      runs.push({
        text: math,
        math: true,
        ...(marks.length > 0 ? { marks: [...marks] } : {}),
      });
      return;
    }
    const reference = element.getAttribute(REFERENCE_ATTRIBUTE);
    if (reference !== null) {
      runs.push({ text: "", equationRef: reference });
      return;
    }
    const figureRef = element.getAttribute(FIGURE_REF_ATTRIBUTE);
    if (figureRef !== null) {
      runs.push({ text: "", figureRef });
      return;
    }
    const tableRef = element.getAttribute(TABLE_REF_ATTRIBUTE);
    if (tableRef !== null) {
      runs.push({ text: "", tableRef });
      return;
    }
    const blockRef = element.getAttribute(BLOCK_REF_ATTRIBUTE);
    if (blockRef !== null) {
      runs.push({ text: "", blockRef });
      return;
    }
    const citedWork = element.getAttribute(CITE_WORK_ATTRIBUTE);
    if (citedWork !== null) {
      const locator = element.getAttribute(CITE_LOCATOR_ATTRIBUTE);
      runs.push({ text: "", cite: { work: citedWork, ...(locator === null ? {} : { locator }) } });
      return;
    }
    const mark = TAG_MARK.get(element.tagName);
    const href = element.tagName === "A" ? element.getAttribute("href") : null;
    const nextMarks = mark === undefined ? marks : [...marks, mark];
    const nextLink = href === null ? link : href;
    for (const child of Array.from(element.childNodes)) {
      walk(child, nextMarks, nextLink);
    }
  };

  for (const child of Array.from(element.childNodes)) {
    walk(child, [], undefined);
  }
  return normalizeRuns(runs);
}

/** How many characters an element holds. */
export function textLength(element: HTMLElement): number {
  return [...(element.textContent ?? "")].length;
}

function offsetOf(
  element: HTMLElement,
  container: Node,
  offset: number,
): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(container, offset);
  return [...range.toString()].length;
}

/** The live selection as character offsets within this element, or null when
 * the selection is not inside it. */
export function selectionIn(
  element: HTMLElement,
): { readonly start: number; readonly end: number } | null {
  const selection = element.ownerDocument.getSelection?.() ?? null;
  if (selection === null || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (
    !element.contains(range.startContainer) ||
    !element.contains(range.endContainer)
  ) {
    return null;
  }
  return {
    start: offsetOf(element, range.startContainer, range.startOffset),
    end: offsetOf(element, range.endContainer, range.endOffset),
  };
}

/**
 * A range as character offsets within this element, clamped to it: an end
 * outside the element counts as the element's own start or end. A passage is
 * one block's words, so a selection dragged past a block's edge is clamped to
 * the block it began in rather than refused. BO_0227_009
 */
export function clampedOffsets(
  element: HTMLElement,
  range: Range,
): { readonly start: number; readonly end: number } {
  const length = textLength(element);
  const before = element.compareDocumentPosition(range.startContainer);
  const start = element.contains(range.startContainer)
    ? offsetOf(element, range.startContainer, range.startOffset)
    : before & Node.DOCUMENT_POSITION_PRECEDING
      ? 0
      : length;
  const after = element.compareDocumentPosition(range.endContainer);
  const end = element.contains(range.endContainer)
    ? offsetOf(element, range.endContainer, range.endOffset)
    : after & Node.DOCUMENT_POSITION_FOLLOWING
      ? length
      : 0;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

/** A DOM range over a character range within this element — what a passage
 * is painted over. BO_0227_009 */
export function rangeAt(
  element: HTMLElement,
  start: number,
  end: number,
): Range {
  const range = element.ownerDocument.createRange();
  const from = positionOf(element, Math.max(0, start));
  const to = positionOf(element, Math.max(0, end));
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

/** The text node and code-unit offset a character offset names. */
function positionOf(
  element: HTMLElement,
  target: number,
): { readonly node: Node; readonly offset: number } {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let last: Node | null = null;
  let node = walker.nextNode();
  while (node !== null) {
    const characters = [...(node.textContent ?? "")];
    if (seen + characters.length >= target) {
      return {
        node,
        offset: characters.slice(0, target - seen).join("").length,
      };
    }
    seen += characters.length;
    last = node;
    node = walker.nextNode();
  }
  return last === null
    ? { node: element, offset: 0 }
    : { node: last, offset: (last.textContent ?? "").length };
}

/** Puts the selection at a character range within this element. */
export function selectRange(
  element: HTMLElement,
  start: number,
  end: number,
): void {
  // The element's own document, which is the page's in a browser and is
  // what the render harness has where it has no global one.
  const selection = element.ownerDocument.getSelection?.() ?? null;
  if (selection === null) return;
  const from = positionOf(element, Math.max(0, start));
  const to = positionOf(element, Math.max(0, end));
  selection.setBaseAndExtent(from.node, from.offset, to.node, to.offset);
}

/** The character offset within this element at a viewport point.
 *
 * A click on reading text has to become a model offset before the block is
 * repainted as an editor, because the repaint replaces the very nodes the
 * point named. `null` means the browser could not place a caret there, and the
 * caller decides what a click that hit no text means. */
export function offsetFromPoint(
  element: HTMLElement,
  x: number,
  y: number,
): number | null {
  const api = element.ownerDocument as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = api.caretPositionFromPoint?.(x, y);
  const found =
    position != null
      ? { node: position.offsetNode, offset: position.offset }
      : ((): { node: Node; offset: number } | null => {
          const range = api.caretRangeFromPoint?.(x, y);
          return range === null || range === undefined
            ? null
            : { node: range.startContainer, offset: range.startOffset };
        })();
  if (found === null || !element.contains(found.node)) return null;
  return offsetOf(element, found.node, found.offset);
}

/** Where a caret at this offset is drawn, or null where nothing is measured:
 * a render harness, or a position the browser gives no box. */
function caretRect(element: HTMLElement, offset: number): DOMRect | null {
  try {
    const range = rangeAt(element, offset, offset);
    const rect = range.getClientRects?.()[0] ?? range.getBoundingClientRect?.();
    if (rect !== undefined && rect.height > 0) return rect;
    // After a line break at the very end, Chromium gives the caret no box;
    // the `<br>` holding that line stands where it is drawn.
    const last = element.lastChild;
    if (offset === textLength(element) && last !== null && last.nodeName === "BR") {
      const line = (last as HTMLElement).getBoundingClientRect();
      return line.height > 0 ? line : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Where the caret stands among the block's drawn lines: whether it is on the
 * first, on the last, how many characters from its line's start, and where
 * it is across the page. A line is one a line break ends or one the block's
 * width wraps; a line break always ends one, so the measure only narrows what
 * the text already says, and where nothing can be measured the text is all
 * there is (`x` null). DO_0003_002
 */
export function caretLine(element: HTMLElement, offset: number): LinePlace & { readonly x: number | null } {
  const text = element.textContent ?? "";
  const place = linePlace(text, offset);
  const caret = caretRect(element, offset);
  const start = caretRect(element, 0);
  const end = caretRect(element, [...text].length);
  if (caret === null || start === null || end === null) return { ...place, x: null };
  const same = (one: DOMRect, other: DOMRect) => Math.abs(one.top - other.top) < Math.min(one.height, other.height) / 2;
  return {
    first: place.first && same(caret, start),
    last: place.last && same(caret, end),
    column: place.column,
    x: caret.left,
  };
}

/**
 * The offset a caret arriving from another block lands at: on this block's
 * last drawn line coming up, its first coming down, at the same place across
 * the page, or at that line's end when the line is shorter. Null when the
 * browser cannot place it there — a block scrolled out of view — and the
 * caller lands by characters instead. DO_0003_002
 */
export function arrivalOffset(element: HTMLElement, x: number, direction: -1 | 1): number | null {
  const line = caretRect(element, direction === 1 ? 0 : [...(element.textContent ?? "")].length);
  if (line === null) return null;
  const box = element.getBoundingClientRect();
  const across = Math.max(box.left + 1, Math.min(x, box.right - 1));
  return offsetFromPoint(element, across, line.top + line.height / 2);
}

/** Whether a non-collapsed selection reaches outside this element.
 *
 * A drag that crossed a block boundary selected text this block does not own.
 * Activating would collapse it, so the caller leaves it alone: at most one
 * block is active, and the reader who dragged across two of them was copying. */
export function selectionEscapes(element: HTMLElement): boolean {
  // The element's own document, so a surface rendered into another one —
  // the render harness's — is judged there too. CA_0046
  const selection = element.ownerDocument.getSelection?.() ?? null;
  if (selection === null || selection.rangeCount === 0) return false;
  if (selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  return !(
    element.contains(range.startContainer) &&
    element.contains(range.endContainer)
  );
}

/** Where the caret sits in the document's title, as an offset into its text.
 *
 * The title holds text and nothing else, so one offset says everything there is
 * to say about where a press landed in it. Read before the surface is re-read,
 * because the repaint replaces the very text node the offset counts into. */
export function titleCaret(title: Element): number | null {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!title.contains(range.startContainer)) return null;
  return range.startContainer === title
    ? 0
    : Math.min(range.startOffset, title.textContent?.length ?? 0);
}

/** Puts the caret back in the title at an offset read before the repaint.
 *
 * Clamped to what the title now holds: the offset was read against the text the
 * reader aimed at, and a rename committed in between may have left less of it. */
export function placeTitleCaret(at: number): void {
  const title = document.querySelector<HTMLElement>("[data-document-title]");
  if (title === null) return;
  const node = title.firstChild;
  const range = document.createRange();
  if (node !== null && node.nodeType === Node.TEXT_NODE) {
    range.setStart(node, Math.min(at, node.textContent?.length ?? 0));
  } else {
    range.setStart(title, 0);
  }
  range.collapse(true);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
