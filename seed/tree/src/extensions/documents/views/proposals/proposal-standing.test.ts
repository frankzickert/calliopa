import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { rowOf, SWIPEABLE_PROPOSALS } from "../block-swipe";
import {
  documentsApi,
  mountEditor,
  pointFrom,
  type SentCommand,
} from "../testing/editor-harness";

/**
 * A proposal takes a standing: the swipe accepts it and the block it becomes
 * takes the standing the release committed, and the same three buttons the
 * block carries in command mode are the path that is not the gesture.
 * BO_0272_008 BO_0272_010
 *
 * The gesture itself is the adapter's, which needs a real pointer and a real
 * layout; what is pressed here is the decision behind it — which rows it may
 * take, what the press writes, and what a refused acceptance leaves.
 */
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening." }] },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "The storm arrives." }] },
    { kind: "text", blockId: "blk-c", revisionId: "rev-c", containmentId: "c-c", order: "c", role: "paragraph", standing: "keep", runs: [{ text: "Closing." }] },
  ],
};

const rewrite = "node:run-claude|replace|node:blk-b";
const newBlock = "node:run-claude|insert|node:blk-new";
const moved = "node:run-claude|move|node:blk-a";
const removal = "node:chg-person|remove|node:blk-c|c-c";

const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 4,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" },
      items: [
        {
          itemId: rewrite,
          groupId: "node:run-claude",
          kind: "replace",
          blockId: "blk-b",
          block: { kind: "text", blockId: "blk-b", revisionId: "rev-b2", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "The storm arrives early." }] },
        },
        {
          itemId: newBlock,
          groupId: "node:run-claude",
          kind: "insert",
          blockId: "blk-new",
          block: { kind: "text", blockId: "blk-new", revisionId: "rev-n", containmentId: "", order: "bb", role: "paragraph", standing: "keep", runs: [{ text: "A new line." }] },
        },
        {
          itemId: moved,
          groupId: "node:run-claude",
          kind: "move",
          blockId: "blk-a",
          block: { kind: "text", blockId: "blk-a", revisionId: "rev-a2", containmentId: "c-a", order: "bc", role: "paragraph", standing: "keep", runs: [{ text: "Opening." }] },
        },
      ],
    },
    {
      groupId: "node:chg-person",
      stagedBy: ["frankzickert"],
      proposer: { kind: "person", name: "frankzickert" },
      items: [{ itemId: removal, groupId: "node:chg-person", kind: "remove", blockId: "blk-c", block: null }],
    },
  ],
};

const mount = async (options: { refuseAnswers?: boolean } = {}) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals, ...options }));
  const view = await mountEditor(draft);
  await view.userEvent('[data-bar-action="proposed-changes"]', "click");
  await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
  const standingOn = (itemId: string) =>
    view.root.querySelector(`[data-proposal-id="${itemId}"] [data-standing-toolbar]`) as HTMLElement | null;
  /** Turns to a proposal, which makes it the bar's subject: the row that
   * carries the buttons while reading. DO_0014_003 */
  const turnTo = async (itemId: string) => {
    await view.userEvent(`[data-proposal-id="${itemId}"]`, "focusin");
    await view.settle();
  };
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, sent, standingOn, commands, waitFor, turnTo };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a proposal takes a standing", () => {
  it("Given each of the three kinds turned to, Then it carries the buttons while the others carry none, and a removal carries none at all", async () => {
    const view = await mount();
    // Nothing is the subject yet, so no proposal carries them.
    expect(view.root.querySelectorAll("[data-standing-toolbar]")).toHaveLength(0);
    for (const itemId of [rewrite, newBlock, moved]) {
      await view.turnTo(itemId);
      expect(
        Array.from(view.standingOn(itemId)?.querySelectorAll("button") ?? []).map((button) =>
          button.getAttribute("aria-label"),
        ),
      ).toEqual(["Discard", "Keep", "Fixate"]);
      // One row is the subject, so one row carries them.
      expect(view.root.querySelectorAll("[data-standing-toolbar]")).toHaveLength(1);
    }
    // Accepting a removal retires its block, so nothing is left to stand.
    await view.turnTo(removal);
    expect(view.standingOn(removal)).toBeFalsy();
    // The gesture takes exactly those three kinds.
    expect([...SWIPEABLE_PROPOSALS]).toEqual(["replace", "insert", "move"]);
    await view.idle();
  });

  it("Given command mode, Then the proposal turned to before it carries no buttons", async () => {
    const view = await mount();
    await view.turnTo(rewrite);
    expect(view.standingOn(rewrite)).not.toBeNull();
    await pointFrom(view, "blk-c");
    expect(view.root.querySelectorAll("[data-standing-toolbar]")).toHaveLength(0);
    await view.idle();
  });

  it("Given Fixate pressed on a proposed new block, Then it is accepted and the block it becomes is fixated", async () => {
    const view = await mount();
    await view.turnTo(newBlock);
    await view.userEvent(
      `[data-proposal-id="${newBlock}"] [data-standing-option="fixate"]`,
      "click",
    );
    await view.waitFor(() => view.commands("setDisposition").length > 0);
    expect(view.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"]])).toEqual([
      [newBlock, "accepted"],
    ]);
    expect(view.commands("setDisposition").map((command) => [command.body["blockId"], command.body["standing"]])).toEqual([
      ["blk-new", "fixate"],
    ]);
    await view.idle();
  });

  it("Given Discard pressed on a proposed rewrite, Then it is accepted and its block discarded", async () => {
    const view = await mount();
    await view.turnTo(rewrite);
    await view.userEvent(
      `[data-proposal-id="${rewrite}"] [data-standing-option="discarded"]`,
      "click",
    );
    await view.waitFor(() => view.commands("setDisposition").length > 0);
    expect(view.commands("answerProposal").map((command) => command.body["answer"])).toEqual(["accepted"]);
    expect(view.commands("setDisposition").map((command) => [command.body["blockId"], command.body["standing"]])).toEqual([
      ["blk-b", "discarded"],
    ]);
    await view.idle();
  });

  it("Given a refused acceptance, Then no standing is written and the refusal is said", async () => {
    const view = await mount({ refuseAnswers: true });
    await view.turnTo(newBlock);
    await view.userEvent(
      `[data-proposal-id="${newBlock}"] [data-standing-option="fixate"]`,
      "click",
    );
    await view.waitFor(() => view.commands("answerProposal").length > 0);
    await view.waitFor(() => view.root.querySelector("[data-notice]") !== null);
    expect(view.commands("setDisposition")).toEqual([]);
    await view.idle();
  });

  it("Given the rows as drawn, Then a swipe may start on the three kinds and on a block, and on nothing else", async () => {
    const view = await mount();
    // `Element`, which `rowOf` tests its target against and the harness does
    // not install globally: an element is what answers to it.
    vi.stubGlobal("Element", {
      [Symbol.hasInstance]: (value: unknown) => (value as { nodeType?: number } | null)?.nodeType === 1,
    });
    const words = (itemId: string) =>
      view.root.querySelector(`[data-proposal-id="${itemId}"] [data-proposal-words]`) as HTMLElement | null;
    for (const itemId of [rewrite, newBlock]) {
      expect(rowOf(words(itemId))?.getAttribute("data-proposal-id")).toBe(itemId);
    }
    // A move has no words of its own; its face is the row it is swiped by.
    const face = view.root.querySelector(`[data-proposal-face="${moved}"]`) as HTMLElement | null;
    expect(rowOf(face)?.getAttribute("data-proposal-id")).toBe(moved);
    // A removal frames a block it would retire: the swipe leaves it alone.
    const removalFace = view.root.querySelector(`[data-proposal-face="${removal}"]`) as HTMLElement | null;
    expect(rowOf(removalFace)).toBeFalsy();
    await view.idle();
  });
});
