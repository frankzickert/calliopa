import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals, ProposedChange } from "../../server/documents";
import { swipedRows } from "../block-swipe";
import { cardItems, cardPlaces, refold } from "../cards";
import { placeProposals, readingOrder } from "../reading-order";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * The card (BO_0350_001–BO_0350_004): an open group is one decision. The rows
 * one group draws next to each other are one card, folded until a pinch in
 * unfolds it; a swipe or Delete on a folded card answers the whole group, and
 * unfolded each row is answered on its own. A pinch, a trackpad's pinch and
 * the `+` and `-` keys fold and unfold it.
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
  documentId: "doc-cards",
  revisionId: "rev-doc",
  title: "Cards",
  blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "The storm arrives."), text("blk-c", "c", "Closing.")],
};

const deepen = "node:run-deepen";
const other = "node:run-other";
const rewrite = `${deepen}|replace|node:blk-b`;
const added = `${deepen}|insert|node:blk-new`;
const elsewhere = `${other}|replace|node:blk-c`;

const items: readonly ProposedChange[] = [
  { itemId: rewrite, groupId: deepen, kind: "replace", blockId: "blk-b", block: { ...text("blk-b", "b", "The storm arrives early."), revisionId: "rev-b2" } },
  { itemId: added, groupId: deepen, kind: "insert", blockId: "blk-new", block: { ...text("blk-new", "bb", "The wind turns first."), containmentId: "" } },
  { itemId: elsewhere, groupId: other, kind: "replace", blockId: "blk-c", block: { ...text("blk-c", "c", "Closing, at last."), revisionId: "rev-c2" } },
];

const proposals: DocumentProposals = {
  documentId: "doc-cards",
  unanswered: 3,
  groups: [
    { groupId: deepen, stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "codex", executedBy: "codex" }, items: items.slice(0, 2) },
    { groupId: other, stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" }, items: items.slice(2) },
  ],
};

const pressKey = (target: Element, name: string): void => {
  const key = target.ownerDocument.createEvent("Event");
  key.initEvent("keydown", true, true);
  Object.defineProperty(key, "key", { value: name });
  target.dispatchEvent(key);
};

const mount = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals }));
  const view = await mountEditor(draft);
  await view.userEvent('[data-bar-action="proposed-changes"]', "click");
  await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
  const row = (itemId: string) => view.root.querySelector(`[data-proposal-id="${itemId}"]`) as HTMLElement;
  const turnTo = async (itemId: string) => {
    await view.userEvent(`[data-proposal-id="${itemId}"]`, "focusin");
    await view.settle();
  };
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name).map((command) => command.body);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, sent, row, turnTo, commands, waitFor };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("which rows make a card", () => {
  const rows = placeProposals(readingOrder(draft.blocks, []), items);

  it("Given a deepen's rewrite and the block it adds, Then they are one folded card, first and last, and another group's row is a card of its own", () => {
    const places = cardPlaces(rows, []);
    expect(places.get(rewrite)).toEqual({ group: deepen, edge: "first", folded: true, segment: 0 });
    expect(places.get(added)).toEqual({ group: deepen, edge: "last", folded: true, segment: 0 });
    expect(places.get(elsewhere)).toEqual({ group: other, edge: "only", folded: true, segment: 0 });
  });

  it("Given the card unfolded, Then its rows are unfolded and the other card stays folded", () => {
    const places = cardPlaces(rows, [deepen]);
    expect(places.get(rewrite)?.folded).toBe(false);
    expect(places.get(added)?.folded).toBe(false);
    expect(places.get(elsewhere)?.folded).toBe(true);
  });

  it("Given a block drawn between two rows of one group, Then the group is a card in each place", () => {
    // A rewrite of the first block and of the last, with the middle block drawn
    // between them.
    const split = placeProposals(readingOrder(draft.blocks, []), [
      { itemId: `${deepen}|replace|node:blk-a`, groupId: deepen, kind: "replace", blockId: "blk-a", block: { ...text("blk-a", "a", "Opening, again."), revisionId: "rev-a2" } },
      { ...(items[2] as ProposedChange), itemId: `${deepen}|replace|node:blk-c`, groupId: deepen },
    ]);
    const places = cardPlaces(split, []);
    expect([...places.values()].map((place) => place.edge)).toEqual(["only", "only"]);
    // Each place is a card of its own, answered on its own. BO_0351_024
    expect([...places.values()].map((place) => place.segment)).toEqual([0, 1]);
    expect(cardItems(places, `${deepen}|replace|node:blk-a`)).toEqual([`${deepen}|replace|node:blk-a`]);
  });

  it("Given a pinch in and out, Then the card unfolds and folds, and twice in holds it once", () => {
    expect(refold([], deepen, "in")).toEqual([deepen]);
    expect(refold([deepen], deepen, "in")).toEqual([deepen]);
    expect(refold([deepen, other], deepen, "out")).toEqual([other]);
  });
});

describe("a card in the editor", () => {
  it("Given the drawn rows, Then each carries its card, and a swipe on a folded one moves every row of it", async () => {
    const view = await mount();
    expect(view.row(rewrite).getAttribute("data-card-group")).toBe(deepen);
    expect(view.row(rewrite).getAttribute("data-card-edge")).toBe("first");
    expect(view.row(added).getAttribute("data-card-edge")).toBe("last");
    expect(view.row(added).getAttribute("data-card-folded")).toBe("true");
    const page = view.root.ownerDocument;
    expect(swipedRows(page, view.row(added))).toEqual({ rows: [view.row(rewrite), view.row(added)], groupId: deepen });
    expect(swipedRows(page, view.row(elsewhere))).toEqual({ rows: [view.row(elsewhere)], groupId: other });
    await view.idle();
  });

  it("Given Delete on a folded card, Then the whole group is rejected and no single item is answered", async () => {
    const view = await mount();
    await view.turnTo(added);
    pressKey(view.row(added), "Delete");
    await view.waitFor(() => view.commands("answerGroup").length === 1);
    expect(view.commands("answerGroup")).toEqual([{ command: "answerGroup", groupId: deepen, answer: "rejected", itemIds: [rewrite, added] }]);
    expect(view.commands("answerProposal")).toEqual([]);
    await view.idle();
  });

  it("Given + on the card turned to, Then it unfolds, Delete answers one item, and - folds it again", async () => {
    const view = await mount();
    await view.turnTo(added);
    pressKey(view.row(added), "+");
    await view.settle(() => view.row(added).getAttribute("data-card-folded") === "false");
    expect(view.row(rewrite).getAttribute("data-card-folded")).toBe("false");
    expect(view.row(elsewhere).getAttribute("data-card-folded")).toBe("true");
    // Unfolded, the swipe moves the row alone.
    expect(swipedRows(view.root.ownerDocument, view.row(added))).toEqual({ rows: [view.row(added)], groupId: null });
    pressKey(view.row(added), "-");
    await view.settle(() => view.row(added).getAttribute("data-card-folded") === "true");
    pressKey(view.row(added), "+");
    await view.settle(() => view.row(added).getAttribute("data-card-folded") === "false");
    pressKey(view.row(added), "Delete");
    await view.waitFor(() => view.commands("answerProposal").length === 1);
    expect(view.commands("answerProposal")[0]).toMatchObject({ itemId: added, answer: "rejected" });
    expect(view.commands("answerGroup")).toEqual([]);
    await view.idle();
  });

  it("Given a pinch on a card, Then zooming in unfolds it and zooming out folds it, and no run is sent", async () => {
    const view = await mount();
    const page = view.root.ownerDocument;
    let under: Element | null = null;
    Object.defineProperty(page, "elementFromPoint", { configurable: true, value: () => under });
    const touch = (type: string, gap: number) => {
      const event = page.createEvent("Event");
      event.initEvent(type, true, true);
      const touches = type === "touchend" ? [] : [{ clientX: 100, clientY: 100 }, { clientX: 100 + gap, clientY: 100 }];
      Object.defineProperty(event, "touches", { value: touches });
      page.dispatchEvent(event);
    };
    const pinch = async (from: number, to: number) => {
      touch("touchstart", from);
      touch("touchmove", to);
      touch("touchend", to);
      await view.settle();
    };
    under = view.row(rewrite).firstElementChild ?? view.row(rewrite);
    await pinch(100, 160);
    await view.settle(() => view.row(rewrite).getAttribute("data-card-folded") === "false");
    await pinch(160, 100);
    await view.settle(() => view.row(rewrite).getAttribute("data-card-folded") === "true");
    expect(view.commands("pinch")).toEqual([]);
    await view.idle();
  });

  it("Given a trackpad's pinch over a card, Then it unfolds once the fingers rest, and the page does not zoom", async () => {
    const view = await mount();
    const page = view.root.ownerDocument;
    Object.defineProperty(page, "elementFromPoint", { configurable: true, value: () => view.row(added) });
    let prevented = 0;
    for (let step = 0; step < 4; step++) {
      const wheel = page.createEvent("Event");
      wheel.initEvent("wheel", true, true);
      Object.defineProperty(wheel, "ctrlKey", { value: true });
      Object.defineProperty(wheel, "deltaY", { value: -10 });
      Object.defineProperty(wheel, "clientX", { value: 10 });
      Object.defineProperty(wheel, "clientY", { value: 10 });
      Object.defineProperty(wheel, "preventDefault", { value: () => (prevented += 1) });
      page.dispatchEvent(wheel);
    }
    expect(prevented).toBe(4);
    await view.waitFor(() => view.row(added).getAttribute("data-card-folded") === "false");
    await view.idle();
  });
});

describe("one card per place", () => {
  // One run's group, standing in two places: a rewrite of the opening and one
  // of the closing, with the middle block between them. BO_0351_024
  const twoPlaces: DocumentProposals = {
    documentId: "doc-cards",
    unanswered: 2,
    groups: [
      {
        groupId: deepen,
        stagedBy: ["agent:hermes"],
        proposer: { kind: "agent", agent: "codex", executedBy: "codex" },
        items: [
          { itemId: `${deepen}|replace|node:blk-a`, groupId: deepen, kind: "replace", blockId: "blk-a", block: { ...text("blk-a", "a", "Opening, again."), revisionId: "rev-a2" } },
          { itemId: `${deepen}|replace|node:blk-c`, groupId: deepen, kind: "replace", blockId: "blk-c", block: { ...text("blk-c", "c", "Closing, at last."), revisionId: "rev-c2" } },
        ],
      },
    ],
  };
  const mountTwo = async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals: twoPlaces }));
    const view = await mountEditor(draft);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
    const row = (itemId: string) => view.root.querySelector(`[data-proposal-id="${itemId}"]`) as HTMLElement;
    const commands = (name: string) => sent.filter((command) => command.body["command"] === name).map((command) => command.body);
    return { ...view, row, commands };
  };

  it("Given a run's group in two places, Then each place is a card of its own, and a swipe moves only its own", async () => {
    const view = await mountTwo();
    const opening = view.row(`${deepen}|replace|node:blk-a`);
    const closing = view.row(`${deepen}|replace|node:blk-c`);
    expect([opening.getAttribute("data-card-segment"), closing.getAttribute("data-card-segment")]).toEqual(["0", "1"]);
    expect(swipedRows(view.root.ownerDocument, opening)).toEqual({ rows: [opening], groupId: deepen });
    await view.idle();
  });

  it("Given Delete on one of the two cards, Then that card alone is rejected and the other stands", async () => {
    const view = await mountTwo();
    await view.userEvent(`[data-proposal-id="${deepen}|replace|node:blk-c"]`, "focusin");
    await view.settle();
    pressKey(view.row(`${deepen}|replace|node:blk-c`), "Delete");
    for (let tick = 0; tick < 200 && view.commands("answerGroup").length === 0; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
    }
    expect(view.commands("answerGroup")).toEqual([{ command: "answerGroup", groupId: deepen, answer: "rejected", itemIds: [`${deepen}|replace|node:blk-c`] }]);
    for (let tick = 0; tick < 200 && view.root.querySelector(`[data-proposal-id="${deepen}|replace|node:blk-c"]`); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
    }
    expect(view.root.querySelector(`[data-proposal-id="${deepen}|replace|node:blk-c"]`)).toBeFalsy();
    expect(view.row(`${deepen}|replace|node:blk-a`)).toBeTruthy();
    await view.idle();
  });
});
