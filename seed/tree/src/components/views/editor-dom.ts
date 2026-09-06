import { MARKS, normalizeRuns, type Mark, type Run } from "~/lib/runs";

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

/** Paints a run list into an element, replacing whatever was there.
 *
 * An empty block still needs a line box or the caret has nowhere to sit, which
 * is what the trailing `<br>` is for; `runsFrom` skips it, so it never becomes
 * content. */
export function paintRuns(element: HTMLElement, runs: readonly Run[]): void {
  element.replaceChildren();
  for (const entry of runs) {
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
  if (runs.length === 0) element.appendChild(document.createElement("br"));
}

/** Reads an element's content back into runs. */
export function runsFrom(element: HTMLElement): Run[] {
  const runs: Run[] = [];

  const walk = (
    node: Node,
    marks: readonly Mark[],
    link: string | undefined,
  ): void => {
    if (node.nodeType === Node.TEXT_NODE) {
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
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") return;
    const mark = TAG_MARK.get(node.tagName);
    const href = node.tagName === "A" ? node.getAttribute("href") : null;
    const nextMarks = mark === undefined ? marks : [...marks, mark];
    const nextLink = href === null ? link : href;
    for (const child of Array.from(node.childNodes)) {
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
  const selection = document.getSelection();
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

/** The text node and code-unit offset a character offset names. */
function positionOf(
  element: HTMLElement,
  target: number,
): { readonly node: Node; readonly offset: number } {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
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
  const selection = document.getSelection();
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
  const api = document as Document & {
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

/** Whether a non-collapsed selection reaches outside this element.
 *
 * A drag that crossed a block boundary selected text this block does not own.
 * Activating would collapse it, so the caller leaves it alone: at most one
 * block is active, and the reader who dragged across two of them was copying. */
export function selectionEscapes(element: HTMLElement): boolean {
  const selection = document.getSelection();
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
