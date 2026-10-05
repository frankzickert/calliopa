import { afterEach, describe, expect, it, vi } from "vitest";

import { readPinchTarget } from "~/lib/command-target";
import { LATER_TARGET, resolveDrop, showsLater, type DragPayload } from "~/lib/drag";
import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals, ProposedChange } from "../../server/documents";
import { CARDS_AT_MOST, drawnGroups, NO_ARRANGEMENT, readArrangementBody } from "../../lib/arrangement";
import { cardOrigin } from "../cards";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * The cards as Hermes arranges them and the person keeps them for later
 * (BO_0350_005–BO_0350_008, BO_0350_013, BO_0350_014, BO_0350_020): the
 * arrangement's cards drawn, or the first seven; collapsed and dimmed blocks;
 * a card dropped on the edge pile deferred, gone from the flow and drawn
 * deferred by *Show proposed changes*; a card naming its run; a one-proposal
 * card's pinch deepening the proposal.
 */
const text = (blockId: string, order: string, words: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-inbox",
  revisionId: "rev-doc",
  title: "Inbox",
  blocks: [text("blk-a", "a", "Opening paragraph of the story."), text("blk-b", "b", "The storm arrives."), text("blk-c", "c", "Closing.")],
};

const rewrite = (group: string, blockId: string, words: string): ProposedChange => ({
  itemId: `${group}|replace|node:${blockId}`,
  groupId: group,
  kind: "replace",
  blockId,
  block: { ...text(blockId, blockId === "blk-a" ? "a" : blockId === "blk-b" ? "b" : "c", words), revisionId: `rev-${group}-${blockId}` },
});

const proposals: DocumentProposals = {
  documentId: "doc-inbox",
  unanswered: 2,
  groups: [
    { groupId: "node:run-one", stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "codex", executedBy: "codex" }, items: [rewrite("node:run-one", "blk-a", "Opening, sharper.")] },
    { groupId: "node:run-two", stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" }, items: [rewrite("node:run-two", "blk-c", "Closing, at last.")] },
  ],
};

const mount = async (options: { arrangement?: ReturnType<typeof readArrangementBody> } = {}) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals, ...(options.arrangement === undefined ? {} : { arrangement: options.arrangement }) }));
  const view = await mountEditor(draft);
  const row = (itemId: string) => view.root.querySelector(`[data-proposal-id="${itemId}"]`) as HTMLElement | null;
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name).map((command) => command.body);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, sent, row, commands, waitFor };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("which groups a document draws", () => {
  const groups = Array.from({ length: 9 }, (_, index) => ({ groupId: `node:run-${index}` }));
  const all = () => true;

  it("Given no arrangement, Then the first seven shown groups are drawn, and a group the reader showed besides", () => {
    const drawn = drawnGroups(groups, all, ["node:run-8"], false, NO_ARRANGEMENT);
    expect([...drawn]).toEqual([...groups.slice(0, CARDS_AT_MOST).map((group) => group.groupId), "node:run-8"]);
  });

  it("Given an arrangement, Then its cards are drawn in its order, and none it names that is not shown", () => {
    const arrangement = readArrangementBody({ arranged: true, cards: ["node:run-5", "node:run-gone", "node:run-2"] });
    expect([...drawnGroups(groups, all, [], false, arrangement)]).toEqual(["node:run-5", "node:run-2"]);
  });

  it("Given a deferred group, Then it leaves the flow and Show proposed changes draws it", () => {
    const standing = [{ groupId: "node:run-0", deferred: true }, { groupId: "node:run-1" }];
    expect([...drawnGroups(standing, all, [], false, NO_ARRANGEMENT)]).toEqual(["node:run-1"]);
    expect([...drawnGroups(standing, all, [], true, NO_ARRANGEMENT)].sort()).toEqual(["node:run-0", "node:run-1"]);
  });

  it("Given an arrangement as the kernel answers it, Then anything malformed reads as none", () => {
    expect(readArrangementBody(null)).toEqual(NO_ARRANGEMENT);
    expect(readArrangementBody({ arranged: true, cards: ["a", 3, ""], collapsed: "x" })).toEqual({ arranged: true, cards: ["a"], collapsed: [], dimmed: [], forward: [] });
  });
});

describe("a card names its run", () => {
  it("Given the run that staged a group, Then the card says its command's first line and the block it was given from", () => {
    const runs = [{ id: "arun-1", goal: "Tighten the opening\nand keep the tone", group: "node:run-one", source: "blk-a", startedAt: 1 }];
    expect(cardOrigin("node:run-one", runs, draft.blocks)).toBe("Tighten the opening — from “Opening paragraph of the story.”");
    expect(cardOrigin("node:run-two", runs, draft.blocks)).toBeNull();
    expect(cardOrigin("node:run-one", [{ ...runs[0], source: null } as (typeof runs)[number] & { source: null }], draft.blocks)).toBe("Tighten the opening");
  });
});

describe("the edge pile and a pinch on a proposal", () => {
  const card: DragPayload = { itemId: "proposal:x", kind: "documents:document", source: "workspace", operations: ["move", "defer"], preview: null };
  const block: DragPayload = { ...card, itemId: "blk-a", operations: ["move"] };

  it("Given a card dragged, Then the pile shows and takes it to defer; a block dragged shows none and lands nothing there", () => {
    expect(showsLater(card)).toBe(true);
    expect(showsLater(block)).toBe(false);
    expect(showsLater(null)).toBe(false);
    expect(resolveDrop(card, { id: LATER_TARGET, accepts: ["defer"] })).toBe("defer");
    expect(resolveDrop(block, { id: LATER_TARGET, accepts: ["defer"] })).toBeNull();
  });

  it("Given a pinch naming a proposal, Then its one reference is the proposal as seen; one naming half of one is refused", () => {
    const target = readPinchTarget({ artifact: "doc-1", block: "blk-a", proposal: { group: "node:run-one", item: "node:run-one|replace|node:blk-a", revisionId: "rev-x" } });
    expect(target).toEqual({
      ok: true,
      target: { artifact: "doc-1", delivery: "propose", references: [{ kind: "block", number: 1, blockId: "blk-a", target: "proposal", group: "node:run-one", item: "node:run-one|replace|node:blk-a", revisionId: "rev-x" }] },
    });
    expect(readPinchTarget({ artifact: "doc-1", block: "blk-a", proposal: { group: "node:run-one" } }).ok).toBe(false);
  });
});

describe("cards in the editor", () => {
  it("Given an arrangement, Then only its card is drawn and its collapsed and dimmed blocks say so", async () => {
    const view = await mount({ arrangement: readArrangementBody({ arranged: true, cards: ["node:run-two"], collapsed: ["blk-a"], dimmed: ["blk-b"] }) });
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.row("node:run-two|replace|node:blk-c") !== null);
    expect(view.row("node:run-one|replace|node:blk-a")).toBeFalsy();
    expect(view.root.querySelector('[data-block-id="blk-b"]')?.getAttribute("data-arranged")).toBe("dimmed");
    await view.idle();
  });

  it("Given a card dropped on the edge pile, Then its group is deferred, it leaves the flow, and Show proposed changes draws it deferred", async () => {
    const view = await mount();
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.row("node:run-one|replace|node:blk-a") !== null);
    // Off, then the card kept for later from the flow.
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    view.record.drop = { itemId: "proposal:node:run-one|replace|node:blk-a", overId: "later", operation: "defer" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.waitFor(() => view.commands("deferGroup").length === 1);
    expect(view.commands("deferGroup")).toEqual([{ command: "deferGroup", groupId: "node:run-one", deferred: true }]);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.waitFor(() => view.row("node:run-one|replace|node:blk-a")?.getAttribute("data-proposal-deferred") === "true");
    expect(view.row("node:run-one|replace|node:blk-a")?.querySelector('[data-card-label="deferred"]')).not.toBeNull();
    expect(view.row("node:run-two|replace|node:blk-c")?.getAttribute("data-proposal-deferred")).toBeNull();
    await view.idle();
  });

  it("Given a pinch in on a card of one proposal, Then it is sent as that proposal deepened, and nothing unfolds", async () => {
    const view = await mount();
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.row("node:run-one|replace|node:blk-a") !== null);
    const page = view.root.ownerDocument;
    Object.defineProperty(page, "elementFromPoint", { configurable: true, value: () => view.row("node:run-one|replace|node:blk-a") });
    const touch = (type: string, gap: number) => {
      const event = page.createEvent("Event");
      event.initEvent(type, true, true);
      Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: 100, clientY: 100 }, { clientX: 100 + gap, clientY: 100 }] });
      page.dispatchEvent(event);
    };
    touch("touchstart", 100);
    touch("touchmove", 160);
    touch("touchend", 160);
    await view.waitFor(() => (view.record.pinches ?? []).length === 1);
    expect(view.record.pinches?.[0]).toMatchObject({
      blockId: "blk-a",
      pinch: "in",
      proposal: { group: "node:run-one", item: "node:run-one|replace|node:blk-a", revisionId: "rev-node:run-one-blk-a" },
    });
    expect(view.row("node:run-one|replace|node:blk-a")?.getAttribute("data-card-folded")).toBe("true");
    await view.idle();
  });
});
