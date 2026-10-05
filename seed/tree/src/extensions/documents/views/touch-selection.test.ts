import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { SAVE_PAUSE_MS } from "./block-editor";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A selection made by touch, pressed through the editor's own JSX and the
 * shell's bar. A long press and the handles fire no keyup and no mouseup; the
 * browser says the range only through `selectionchange`, which is all this
 * test gives the editor before the bar is pressed. DO_0039_001
 *
 * The render harness has no selection of its own, so the page gets one: a
 * range over the block's text nodes, enough for `selectionIn` and
 * `selectRange` to read and write it as they do in a browser.
 */
const draft: DocumentView = {
  documentId: "doc-touch",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    {
      kind: "text",
      blockId: "blk-a",
      revisionId: "rev-blk-a",
      containmentId: "c-blk-a",
      order: "a",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "Make this word bold." }],
    } satisfies BlockView,
  ],
};

type Point = { node: Node; offset: number };

/** The text before a point inside a root, counted over its text nodes. */
function textBefore(root: Node, point: Point): string {
  let text = "";
  const walk = (node: Node): boolean => {
    if (node === point.node) {
      if (node.nodeType === 3) text += (node.textContent ?? "").slice(0, point.offset);
      else Array.from(node.childNodes).slice(0, point.offset).forEach((child) => { text += child.textContent ?? ""; });
      return true;
    }
    if (node.nodeType === 3) {
      text += node.textContent ?? "";
      return false;
    }
    return Array.from(node.childNodes).some(walk);
  };
  walk(root);
  return text;
}

function installSelection(doc: Document) {
  let anchor: Point | null = null;
  let focus: Point | null = null;
  const selection = {
    get rangeCount() { return anchor === null ? 0 : 1; },
    get isCollapsed() { return anchor === null || (anchor.node === focus?.node && anchor.offset === focus.offset); },
    get anchorNode() { return anchor?.node ?? null; },
    get focusNode() { return focus?.node ?? null; },
    getRangeAt: () => ({
      startContainer: anchor!.node,
      startOffset: anchor!.offset,
      endContainer: focus!.node,
      endOffset: focus!.offset,
      // What the reading surface asks of a range to find the rows it marks;
      // a selection inside the block being edited marks none.
      intersectsNode: () => false,
    }),
    setBaseAndExtent(anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number) {
      anchor = { node: anchorNode, offset: anchorOffset };
      focus = { node: focusNode, offset: focusOffset };
    },
    removeAllRanges() { anchor = null; focus = null; },
  };
  Object.defineProperty(doc, "getSelection", { configurable: true, value: () => selection });
  Object.defineProperty(doc, "createRange", {
    configurable: true,
    value: () => {
      let root: Node | null = null;
      let end: Point | null = null;
      return {
        selectNodeContents(node: Node) { root = node; },
        setEnd(node: Node, offset: number) { end = { node, offset }; },
        toString: () => (root === null || end === null ? "" : textBefore(root, end)),
      };
    },
  });
  return selection;
}

let last: { settle: () => Promise<void>; idle: () => Promise<void> } | null = null;

afterEach(async () => {
  for (let round = 0; round < 3; round++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await last?.settle();
    await last?.idle();
  }
  last = null;
  vi.unstubAllGlobals();
});

async function mount() {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent));
  // `selectRange` walks the block's text nodes, which the harness's DOM does
  // with a filter the page names globally.
  vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  const view = await mountEditor(draft);
  last = { settle: () => view.settle(), idle: () => view.idle() };
  const doc = view.root.ownerDocument;
  const selection = installSelection(doc);
  const editor = () => view.root.querySelector<HTMLElement>("[data-block-editor]") ?? null;
  const toggle = (id: string) => view.root.querySelector<HTMLElement>(`[data-bar-action="${id}"]`) ?? null;
  /** Selects characters of the block being edited the way a touch does: the
   * range changes and the page fires `selectionchange`, nothing else. */
  const touchSelect = async (start: number, end: number) => {
    const text = editor()?.firstChild ?? null;
    if (text === null || text.nodeType !== 3) throw new Error("the block being edited holds no text node");
    selection.setBaseAndExtent(text, start, text, end);
    const changed = doc.createEvent("Event");
    changed.initEvent("selectionchange", false, false);
    doc.dispatchEvent(changed);
    await view.settle();
  };
  const press = async (id: string) => {
    await view.idle();
    await view.userEvent(`[data-bar-action="${id}"]`, "click");
    await view.settle();
  };
  const revisions = () => sent.filter((entry) => entry.body["command"] === "revise").map((entry) => entry.body);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 300; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, editor, toggle, touchSelect, press, revisions, waitFor };
}

describe("a selection made by touch (DO_0039_001)", () => {
  it("Given words selected with no key and no mouse event, When Bold and then Italic are pressed, Then both marks land on those words and are saved", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    const word = "Make this ".length;
    await view.touchSelect(word, word + "word".length);
    await view.press("mark-bold");
    expect(view.editor()?.querySelector("strong")?.textContent).toBe("word");
    expect(view.toggle("mark-bold")?.getAttribute("aria-pressed")).toBe("true");
    await view.press("mark-italic");
    expect(view.toggle("mark-italic")?.getAttribute("aria-pressed")).toBe("true");
    await view.waitFor(() => view.revisions().length > 0);
    expect(view.revisions().at(-1)).toMatchObject({
      blockId: "blk-a",
      runs: [
        { text: "Make this " },
        { text: "word", marks: ["bold", "italic"] },
        { text: " bold." },
      ],
    });
    await view.idle();
  }, SAVE_PAUSE_MS + 5000);

  it("Given a selection made by touch in another element, Then the block being edited keeps its own range", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    const outside = view.root.ownerDocument.createTextNode("elsewhere");
    view.root.appendChild(outside);
    view.root.ownerDocument.getSelection()!.setBaseAndExtent(outside, 0, outside, 4);
    const changed = view.root.ownerDocument.createEvent("Event");
    changed.initEvent("selectionchange", false, false);
    view.root.ownerDocument.dispatchEvent(changed);
    await view.settle();
    await view.press("mark-bold");
    expect(view.editor()?.querySelector("strong") ?? null).toBeNull();
    await view.idle();
  });
});
