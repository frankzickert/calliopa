import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Removing marked blocks (DO_0023, BO_0315_011), pressed in Qwik's render
 * harness: a text selection marking several rows leaves no row its controls
 * and stands the bar's single-block controls disabled, and one press of
 * Delete or Backspace retires every marked block in one write and declines
 * every marked proposal,
 * leaving the selection cleared and nothing focused. A press gives no row the
 * focus until it ends, and on a pointer that hovers a proposal's text takes
 * typing once clicked rather than while it is hovered. Where a drag actually
 * runs is the browser's, walked on the instance.
 */
const text = (blockId: string, order: string, words: string, standing: "keep" | "fixate" = "keep") => ({
  kind: "text" as const,
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph" as const,
  standing,
  runs: [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    text("blk-a", "a", "Opening."),
    text("blk-b", "b", "The storm arrives.", "fixate"),
    text("blk-c", "c", "Closing."),
  ],
};

const inserted = "node:run-claude|insert|node:blk-p";
const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" },
      items: [
        {
          itemId: inserted,
          groupId: "node:run-claude",
          kind: "insert",
          blockId: "blk-p",
          block: text("blk-p", "bm", "A proposed sentence."),
        },
      ],
    },
  ],
};

/** A page read with a pointer that hovers, or not. */
const pointer = (hovers: boolean) =>
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: hovers, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

/** An event of the harness's own document, which has no constructors. */
const event = (doc: Document, type: string): Event => {
  const made = doc.createEvent("Event");
  made.initEvent(type, true, true);
  return made;
};

/**
 * The page's selection, as a browser would hold it over the named rows: the
 * range meets each of those rows and their words and nothing else. The rows
 * are found when the selection is read, since the editor draws them again.
 */
function installSelection(doc: Document) {
  let covered: string[] = [];
  let cleared = 0;
  const rowOf = (node: Node): Element | null => {
    const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    return element?.closest(".block-row[data-block-id], .proposal-block[data-proposal-id]") ?? null;
  };
  const named = (row: Element | null) =>
    row !== null && covered.includes(row.getAttribute("data-block-id") ?? row.getAttribute("data-proposal-id") ?? "");
  const range = {
    startContainer: null,
    endContainer: null,
    startOffset: 0,
    endOffset: 0,
    intersectsNode: (node: Node) => named(rowOf(node)),
    // Neither end holds a row whole: each is reached through its words.
    compareBoundaryPoints: (how: number) => (how === 0 ? 1 : -1),
  };
  const selection = {
    get rangeCount() { return covered.length === 0 ? 0 : 1; },
    get isCollapsed() { return covered.length === 0; },
    getRangeAt: () => range,
    removeAllRanges: () => {
      covered = [];
      cleared += 1;
      doc.dispatchEvent(event(doc, "selectionchange"));
    },
  };
  Object.defineProperty(doc, "getSelection", { configurable: true, value: () => selection });
  Object.defineProperty(doc, "createRange", { configurable: true, value: () => ({ selectNodeContents: () => undefined }) });
  return {
    select: (rows: string[]) => {
      covered = rows;
      doc.dispatchEvent(event(doc, "selectionchange"));
    },
    cleared: () => cleared,
  };
}

/** A key pressed where the page hears it: the view listens on the document,
 * which the harness's own events do not reach. */
const pressKey = (target: HTMLElement, name: string): void => {
  const key = target.ownerDocument.createEvent("Event");
  key.initEvent("keydown", true, true);
  Object.defineProperty(key, "key", { value: name });
  target.dispatchEvent(key);
};

const mount = async (options: { withProposal?: boolean } = {}) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { follow: true, ...(options.withProposal === true ? { proposals } : {}) }));
  const view = await mountEditor(draft);
  if (options.withProposal === true) {
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-id]") != null);
  }
  const doc = view.root.ownerDocument;
  const selection = installSelection(doc);
  const body = () => view.root.querySelector("[data-view-body]") as HTMLElement;
  const bar = (id: string) => (view.root.querySelector(`[data-bar-action="${id}"]`) as HTMLElement | null) ?? null;
  const commands = (command: string) => sent.filter(({ body: sentBody }) => sentBody["command"] === command).map(({ body: sentBody }) => sentBody);
  const select = async (rows: string[]) => {
    selection.select(rows);
    await view.settle();
  };
  return { ...view, sent, doc, selection, body, bar, commands, select };
};

describe("a selection marking several blocks", () => {
  it("Given a selection over several rows, Then no row is the bar's subject and the single-block controls stand disabled, with no Retire in the bar", async () => {
    const view = await mount();
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
    await view.settle(() => view.bar("block-add-paragraph") != null);

    await view.select(["blk-a", "blk-b", "blk-c"]);
    await view.settle(() => view.body().hasAttribute("data-marks-several"));
    // Removing is the keys' now, never the top bar's. BO_0315_012
    expect(view.bar("block-retire")).toBeNull();
    for (const id of ["block-role", "block-add-paragraph", "block-add-image", "block-add-table", "block-add-equation", "block-add-code", "block-import-table", "block-standing"]) {
      expect(view.bar(id)?.hasAttribute("disabled"), id).toBe(true);
    }
    await view.idle();
  });

  it("Given a selection inside one block, Then nothing is marked several and the bar is as it was", async () => {
    const view = await mount();
    await view.select(["blk-b"]);
    expect(view.body().hasAttribute("data-marks-several")).toBe(false);
    expect(view.bar("block-retire")).toBeNull();
    await view.idle();
  });

  it("When Delete is pressed over an accepted block, a fixated block and a proposal, Then both blocks retire in one write at the revisions read, the proposal is declined, the selection clears and nothing is focused", async () => {
    const view = await mount({ withProposal: true });
    await view.select(["blk-a", inserted, "blk-b"]);
    await view.settle(() => view.body().hasAttribute("data-marks-several"));
    pressKey(view.body(), "Delete");
    await view.settle(() => view.root.querySelector('[data-block-id="blk-a"]') == null && view.commands("answerProposal").length === 1);

    expect(view.commands("retireBlocks")).toEqual([
      { command: "retireBlocks", blocks: [{ blockId: "blk-a", baseRevisionId: "rev-blk-a" }, { blockId: "blk-b", baseRevisionId: "rev-blk-b" }] },
    ]);
    expect(view.commands("retire")).toEqual([]);
    expect(view.commands("answerProposal")).toEqual([expect.objectContaining({ itemId: inserted, answer: "rejected" })]);
    expect(view.root.querySelector('[data-block-id="blk-b"]') ?? null).toBeNull();
    expect(view.root.querySelector('[data-block-id="blk-c"]') ?? null).not.toBeNull();
    expect(view.selection.cleared()).toBeGreaterThan(0);
    expect(view.body().hasAttribute("data-marks-several")).toBe(false);
    expect(view.root.querySelector('[data-focused="true"]') ?? null).toBeNull();
    await view.idle();
  });

  it("Given a press under way, When a row takes the browser's focus, Then it is focused only once the press ends, and not at all when the press marked several rows", async () => {
    const view = await mount({ withProposal: true });
    const proposal = () => view.root.querySelector(`[data-proposal-id="${inserted}"]`) as HTMLElement;
    const pointerEvent = (type: string) => event(view.doc, type);
    // `Element`, which the editor's own press listener tests its targets
    // against and the harness does not install globally.
    vi.stubGlobal("Element", {
      [Symbol.hasInstance]: (value: unknown) => (value as { nodeType?: number } | null)?.nodeType === 1,
    });

    view.doc.dispatchEvent(pointerEvent("pointerdown"));
    await view.userEvent(`[data-proposal-id="${inserted}"]`, "focusin");
    await view.settle();
    expect(proposal().getAttribute("data-focused")).toBeNull();
    view.doc.dispatchEvent(pointerEvent("pointerup"));
    await view.settle(() => proposal().getAttribute("data-focused") === "true");
    expect(proposal().getAttribute("data-focused")).toBe("true");

    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector(`[data-proposal-id="${inserted}"]`) != null);
    view.doc.dispatchEvent(pointerEvent("pointerdown"));
    await view.userEvent('[data-block-id="blk-c"]', "focusin");
    await view.select(["blk-b", "blk-c"]);
    view.doc.dispatchEvent(pointerEvent("pointerup"));
    await view.settle();
    expect(view.root.querySelector('[data-block-id="blk-c"]')?.getAttribute("data-focused")).toBeNull();
    await view.idle();
  });
});

describe("a proposal's text on a pointer that hovers", () => {
  it("Given a pointer that hovers, Then a proposal's text takes no typing at rest, so a drag from it can run on; a click in it gives it the caret", async () => {
    pointer(true);
    const view = await mount({ withProposal: true });
    const words = () => view.root.querySelector("[data-proposal-text]") as HTMLElement;
    await view.settle();
    expect(words().getAttribute("contenteditable")).toBe("false");
    expect(words().getAttribute("tabindex")).toBe("0");

    // The click placed the caret in the words, as a browser's does.
    const caret = { startContainer: words(), endContainer: words(), startOffset: 0, endOffset: 0, collapsed: true };
    Object.defineProperty(view.doc, "getSelection", {
      configurable: true,
      value: () => ({ rangeCount: 1, isCollapsed: true, getRangeAt: () => caret, setBaseAndExtent: () => undefined, removeAllRanges: () => undefined }),
    });
    // The offsets are read through a range over the words up to the caret,
    // which the harness's document cannot make.
    const createRange = () => {
      let words = "";
      let end = 0;
      return {
        selectNodeContents: (node: Node) => {
          words = node.textContent ?? "";
        },
        setEnd: (_: Node, offset: number) => {
          end = offset;
        },
        toString: () => words.slice(0, end),
      };
    };
    Object.defineProperty(view.doc, "createRange", { configurable: true, value: createRange });
    vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
    await view.userEvent("[data-proposal-text]", "pointerdown");
    await view.userEvent("[data-proposal-text]", "click");
    await view.settle(() => words().getAttribute("contenteditable") === "true");
    expect(words().getAttribute("contenteditable")).toBe("true");
    await view.idle();
  });
});

/**
 * Retiring a selection declines its proposals together (`DO_0024_001`): the
 * three answers go out without waiting on each other, the proposals are read
 * once when all are in, one already settled by an earlier answer is gone,
 * and one refused stays and is named in the one notice. DO_0024_004
 */
describe("declining marked proposals together", () => {
  const three = ["p1", "p2", "p3"].map((name, index) => ({
    itemId: `node:run-${index < 2 ? "one" : "two"}|insert|node:blk-${name}`,
    groupId: `node:run-${index < 2 ? "one" : "two"}`,
    kind: "insert",
    blockId: `blk-${name}`,
    block: text(`blk-${name}`, `b${index}`, `Proposed ${name}.`),
  }));
  const [settled, refusedItem, declined] = three.map((item) => item.itemId) as [string, string, string];
  const marked: DocumentProposals = {
    documentId: "doc-1",
    unanswered: 3,
    groups: [
      { groupId: "node:run-one", stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" }, items: three.slice(0, 2) as never },
      { groupId: "node:run-two", stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "codex", executedBy: "codex" }, items: three.slice(2) as never },
    ],
  };

  it("When Backspace is pressed over three proposals, Then the three answers go out together, the proposals are read once, the settled one goes and the refused one stays, named", async () => {
    const sent: SentCommand[] = [];
    let reads = 0;
    let served: DocumentProposals = marked;
    vi.stubGlobal(
      "fetch",
      documentsApi(draft, sent, {
        follow: true,
        proposalsRead: () => served,
        proposalsDelayMs: () => {
          reads += 1;
          return 0;
        },
        answerDelayMs: 300,
        refuseAnswer: (itemId) =>
          itemId === settled
            ? { status: 409, outcome: "storageError", detail: `${settled} is not an undecided member of proposal node:run-one` }
            : itemId === refusedItem
              ? { status: 502, outcome: "storageError", detail: "the kernel is unreachable" }
              : undefined,
      }),
    );
    const view = await mountEditor(draft);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelectorAll("[data-proposal-id]").length === 3);
    const selection = installSelection(view.root.ownerDocument);
    selection.select([settled, refusedItem, declined]);
    const body = view.root.querySelector("[data-view-body]") as HTMLElement;
    await view.settle(() => body.hasAttribute("data-marks-several"));
    const answers = () => sent.filter(({ body }) => body["command"] === "answerProposal");
    reads = 0;
    // What stands after the answers: the declined and the settled are gone.
    served = { ...marked, unanswered: 1, groups: [{ ...marked.groups[0]!, items: [three[1]] as never }] };

    const pressed = Date.now();
    pressKey(body, "Backspace");
    // Every answer is sent without waiting on the others: three answers of
    // 300 ms each, one after another, sent the third after 600 ms.
    for (let tick = 0; tick < 100 && answers().length < 3; tick++) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(answers().length).toBe(3);
    expect(Date.now() - pressed).toBeLessThan(290);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await view.settle(() => view.root.querySelector(`[data-proposal-id="${refusedItem}"]`) != null);

    expect(answers().map(({ body }) => body["itemId"]).sort()).toEqual([settled, refusedItem, declined].sort());
    expect(answers().every(({ body }) => body["answer"] === "rejected")).toBe(true);
    expect(view.root.querySelector(`[data-proposal-id="${settled}"]`) ?? null).toBeNull();
    expect(view.root.querySelector(`[data-proposal-id="${declined}"]`) ?? null).toBeNull();
    const notice = view.root.querySelector("[data-block-error]")?.textContent ?? "";
    expect(notice).toContain("Proposed p2.");
    expect(notice).not.toContain("Proposed p1.");
    expect(notice).toContain("the kernel is unreachable");
    expect(reads).toBe(1);
    await view.idle();
  });
});
