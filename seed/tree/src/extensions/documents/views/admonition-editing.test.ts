import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdmonitionBlockView, DocumentView, TextBlockView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

const child = (blockId: string, order: string, words: string): TextBlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `contains-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: [{ text: words }],
});

const callout: AdmonitionBlockView = {
  kind: "admonition",
  blockId: "callout",
  revisionId: "rev-callout",
  containmentId: "contains-callout",
  order: "a",
  patternId: "pattern-1",
  children: [child("child-a", "a", "First line"), child("child-b", "b", "Second line")],
};

const draft: DocumentView = { documentId: "doc-admonition", revisionId: "rev-doc", title: "Callout", blocks: [callout] };
let last: { settle: () => Promise<void>; idle: () => Promise<void> } | null = null;

function installCaretHarness(doc: Document, withLineGeometry = false) {
  class HarnessRange {
    startContainer: Node = doc.createTextNode("");
    startOffset = 0;
    endContainer: Node = this.startContainer;
    endOffset = 0;
    get collapsed() { return this.startContainer === this.endContainer && this.startOffset === this.endOffset; }
    selectNodeContents(element: Node) {
      if (element.nodeType === 3) {
        this.startContainer = element;
        this.startOffset = 0;
        this.endContainer = element;
        this.endOffset = element.textContent?.length ?? 0;
        return;
      }
      const walker = doc.createTreeWalker(element, 4);
      const first = walker.nextNode();
      if (first === null) {
        this.startContainer = element;
        this.startOffset = 0;
        this.endContainer = element;
        this.endOffset = 0;
        return;
      }
      let last = first;
      let next = walker.nextNode();
      while (next !== null) { last = next; next = walker.nextNode(); }
      this.startContainer = first;
      this.startOffset = 0;
      this.endContainer = last;
      this.endOffset = last.textContent?.length ?? 0;
    }
    setStart(node: Node, offset: number) {
      this.startContainer = node;
      this.startOffset = offset;
      if (node === this.endContainer && offset > this.endOffset) {
        this.endContainer = node;
        this.endOffset = offset;
      }
    }
    setEnd(node: Node, offset: number) {
      this.endContainer = node;
      this.endOffset = offset;
      if (node === this.startContainer && offset < this.startOffset) {
        this.startContainer = node;
        this.startOffset = offset;
      }
    }
    collapse(toStart = false) {
      if (toStart) { this.endContainer = this.startContainer; this.endOffset = this.startOffset; }
      else { this.startContainer = this.endContainer; this.startOffset = this.endOffset; }
    }
    cloneRange() {
      const copy = new HarnessRange();
      copy.startContainer = this.startContainer;
      copy.startOffset = this.startOffset;
      copy.endContainer = this.endContainer;
      copy.endOffset = this.endOffset;
      return copy;
    }
    toString() {
      if (this.startContainer === this.endContainer) return this.startContainer.textContent?.slice(this.startOffset, this.endOffset) ?? "";
      return this.startContainer.textContent?.slice(this.startOffset) ?? "";
    }
    getBoundingClientRect() {
      return withLineGeometry
        ? { top: 10, bottom: 29, left: 8 + this.startOffset * 8, height: 19 } as DOMRect
        : { top: 0, bottom: 0, left: 0, height: 0 } as DOMRect;
    }
    getClientRects() {
      return (withLineGeometry ? [{ top: 10, bottom: 29, left: 8, right: 88, width: 80, height: 19 }] : []) as unknown as DOMRectList;
    }
  }
  let activeRange: HarnessRange | null = null;
  const selection = {
    get rangeCount() { return activeRange === null ? 0 : 1; },
    get isCollapsed() { return activeRange?.collapsed ?? true; },
    get anchorNode() { return activeRange?.startContainer ?? null; },
    get anchorOffset() { return activeRange?.startOffset ?? 0; },
    getRangeAt: () => activeRange as unknown as Range,
    removeAllRanges: () => { activeRange = null; },
    addRange: (range: Range) => { activeRange = range as unknown as HarnessRange; },
  };
  Object.defineProperty(doc, "createRange", { configurable: true, value: () => new HarnessRange() });
  Object.defineProperty(doc.defaultView, "getSelection", { configurable: true, value: () => selection });
  Object.defineProperty(doc.defaultView, "getComputedStyle", { configurable: true, value: () => ({ borderTopWidth: "0px", borderBottomWidth: "0px", paddingTop: "0px", paddingBottom: "0px", lineHeight: "16px", fontSize: "16px" }) });
}

afterEach(async () => {
  await last?.settle();
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

async function mount(withLineGeometry = false) {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { follow: true }));
  const view = await mountEditor(draft);
  last = { settle: () => view.settle(), idle: () => view.idle() };
  const doc = view.root.ownerDocument;
  const win = doc.defaultView;
  if (win === null) throw new Error("the render harness document has no window");
  installCaretHarness(doc, withLineGeometry);
  let focusedChild: string | null = null;
  const firstChild = view.root.querySelector<HTMLElement>('[data-block-id="child-a"]');
  if (firstChild === undefined || firstChild === null) throw new Error("missing first admonition child");
  Object.defineProperty(Object.getPrototypeOf(firstChild), "focus", { configurable: true, value(this: HTMLElement) { focusedChild = this.getAttribute("data-block-id"); } });
  Object.defineProperty(Object.getPrototypeOf(firstChild), "getBoundingClientRect", { configurable: true, value: () => withLineGeometry ? ({ top: 10, bottom: 34, left: 0, height: 24 }) : ({ top: 0, bottom: 0, left: 0, height: 0 }) });
  const findChild = (blockId: string) => view.root.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`) ?? null;
  const placeCaret = (blockId: string, offset: number) => {
    const element = findChild(blockId);
    if (element === null) throw new Error(`missing child ${blockId}`);
    element.focus();
    const range = doc.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    const walker = doc.createTreeWalker(element, 4);
    const node = walker.nextNode();
    if (node !== null) range.setStart(node, Math.min(offset, node.textContent?.length ?? 0));
    const selection = win.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  const press = async (blockId: string, key: string) => {
    await view.userEvent(`[data-block-id="${blockId}"]`, "keydown", { key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false });
    await view.settle();
  };
  const commands = (command: string) => sent.filter(({ body }) => body["command"] === command).map(({ body }) => body);
  return { ...view, doc, win, findChild, placeCaret, press, commands, focusedChild: () => focusedChild };
}

describe("admonition child editing (DO_0021_001)", () => {
  it("Enter splits at the caret and focuses the new ordered child at its start", async () => {
    const view = await mount();
    view.placeCaret("child-a", 5);
    await view.press("child-a", "Enter");
    await view.settle();
    const newChild = view.root.querySelector<HTMLElement>('[data-block-id^="child-added-"]') ?? null;
    expect(newChild?.textContent).toBe(" line");
    expect(view.focusedChild()).toBe(newChild?.getAttribute("data-block-id"));
    const selection = view.win.getSelection();
    expect(selection?.anchorNode?.textContent).toBe(" line");
    expect(selection?.anchorOffset).toBe(0);
    expect(view.commands("revise")[0]).toMatchObject({ blockId: "child-a", runs: [{ text: "First" }] });
    expect(view.commands("insertAdmonitionChild")[0]).toMatchObject({ parentBlockId: "callout", afterBlockId: "child-a", runs: [{ text: " line" }] });
  });

  it("ArrowDown and ArrowUp cross children at their visual edges", async () => {
    const view = await mount();
    view.placeCaret("child-a", "First line".length);
    await view.press("child-a", "ArrowDown");
    expect(view.focusedChild()).toBe("child-b");
    expect(view.win.getSelection()?.anchorOffset).toBe(0);
    await view.press("child-b", "ArrowUp");
    expect(view.focusedChild()).toBe("child-a");
    expect(view.win.getSelection()?.anchorOffset).toBe("First line".length);
  });

  it("Arrow navigation uses text line edges when a child has extra minimum height", async () => {
    const view = await mount(true);
    expect(view.root.querySelector(".admonition__add") ?? null).toBeNull();
    view.placeCaret("child-a", 5);
    await view.press("child-a", "ArrowDown");
    expect(view.focusedChild()).toBe("child-b");
    expect(view.win.getSelection()?.anchorOffset).toBe(5);
    view.placeCaret("child-b", 5);
    await view.press("child-b", "ArrowUp");
    expect(view.focusedChild()).toBe("child-a");
    expect(view.win.getSelection()?.anchorOffset).toBe(5);
  });

  it("Backspace at a child start merges into the previous child and retires the absorbed child", async () => {
    const view = await mount();
    view.placeCaret("child-b", 0);
    await view.press("child-b", "Backspace");
    await view.settle();
    expect(view.commands("mergeAdmonitionChild")[0]).toMatchObject({ parentBlockId: "callout", intoBlockId: "child-a", blockId: "child-b" });
    expect(view.findChild("child-a")?.textContent).toBe("First lineSecond line");
    expect(view.findChild("child-b")).toBeNull();
    expect(view.focusedChild()).toBe("child-a");
    expect(view.win.getSelection()?.anchorOffset).toBe("First line".length);
    const retired = await (await fetch("/api/x/documents/d/doc-admonition/retired")).json() as { result: TextBlockView[] };
    expect(retired.result.map((entry) => entry.blockId)).toContain("child-b");
  });

  it("Delete at a child end merges into the next child", async () => {
    const view = await mount();
    view.placeCaret("child-a", "First line".length);
    await view.press("child-a", "Delete");
    await view.settle();
    expect(view.commands("mergeAdmonitionChild")[0]).toMatchObject({ parentBlockId: "callout", intoBlockId: "child-a", blockId: "child-b" });
    expect(view.findChild("child-a")?.textContent).toBe("First lineSecond line");
    expect(view.findChild("child-b")).toBeNull();
  });
});
