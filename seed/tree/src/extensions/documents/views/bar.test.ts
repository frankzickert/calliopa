import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import {
  documentsApi,
  mountEditor,
  type SentCommand,
} from "./testing/editor-harness";

/**
 * The document's bar pressed in Qwik's render harness, drawn by the shell's
 * own `ViewBarPanel` from what the editor contributes: the view group and the
 * document group always, the block groups only while a block is active.
 * CA_0053_006 CA_0053_007
 */
const draft: DocumentView = {
  documentId: "doc-bar",
  revisionId: "rev-doc",
  title: "Bar",
  blocks: [
    {
      kind: "text",
      blockId: "blk-a",
      revisionId: "rev-a",
      containmentId: "c-a",
      order: "a",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "Opening." }],
    },
    {
      kind: "text",
      blockId: "blk-b",
      revisionId: "rev-b",
      containmentId: "c-b",
      order: "b",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "Closing." }],
    },
  ],
};

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

const mount = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent));
  const harness = await mountEditor(draft);
  last = harness;
  return { ...harness, sent };
};

// This DOM answers undefined, not null, when nothing matches (BO_0224).
const groupIds = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("[data-bar-group]")).map((group) =>
    group.getAttribute("data-bar-group"),
  );
const bar = (root: HTMLElement, id: string) =>
  (root.querySelector(`[data-bar-action="${id}"]`) as HTMLElement | null) ??
  null;

const activate = async (
  view: Awaited<ReturnType<typeof mount>>,
  blockId: string,
) => {
  await view.userEvent(
    `[data-block-id="${blockId}"] [data-block-reading]`,
    "focus",
  );
  await view.userEvent(
    `[data-block-id="${blockId}"] [data-block-reading]`,
    "keydown",
    { key: "Enter" },
  );
  await view.settle(() => view.root.querySelector("[data-block-editor]") != null);
};

describe("the document's bar", () => {
  it("Given a document read with no block active, Then the bar holds the view group and the trailing document group", async () => {
    const { root } = await mount();
    expect(groupIds(root)).toEqual(["work", "view", "document"]);
    const toggles = ["retired-blocks", "discarded-blocks", "proposed-changes"];
    expect(
      toggles.map((id) => ({
        pressed: bar(root, id)?.getAttribute("aria-pressed"),
        name: bar(root, id)?.getAttribute("aria-label"),
        icon: bar(root, id)?.querySelector("[data-icon]")?.getAttribute("data-icon"),
      })),
    ).toEqual([
      { pressed: "false", name: "Show retired blocks", icon: "archive" },
      { pressed: "false", name: "Show discarded blocks", icon: "eye-slash" },
      { pressed: "false", name: "Show proposed changes", icon: "git-pull-request" },
    ]);
    const trailing = root.querySelector(".view-bar__trailing");
    expect(
      trailing?.querySelector('[data-bar-action="delete-document"]')?.getAttribute("aria-label"),
    ).toBe("Delete");
    // The line belongs to the later group: the document group carries it,
    // the first carries none.
    expect(root.querySelector('[data-bar-group="work"]')?.hasAttribute("data-ruled")).toBe(false);
    expect(root.querySelector('[data-bar-group="view"]')?.hasAttribute("data-ruled")).toBe(true);
    expect(root.querySelector('[data-bar-group="document"]')?.hasAttribute("data-ruled")).toBe(true);
    // The inspector keeps the document's facts and contributes no action.
    expect(root.querySelector("[data-inspector-action]") ?? null).toBeNull();
  });

  it("Given a block activated, Then the block groups stand between the view and the document, and leaving takes them away", async () => {
    const view = await mount();
    await activate(view, "blk-a");
    expect(groupIds(view.root)).toEqual([
      "work",
      "view",
      "format",
      "turn-into",
      "block",
      "standing",
      "history",
      "document",
    ]);
    expect(bar(view.root, "block-retire")?.getAttribute("aria-label")).toBe(
      "Retire block 1",
    );
    expect(bar(view.root, "block-undo")?.hasAttribute("disabled")).toBe(true);
    expect(bar(view.root, "mark-bold")?.getAttribute("aria-pressed")).toBe("false");

    await view.userEvent('[data-bar-action="block-done"]', "click");
    await view.settle(() => view.root.querySelector("[data-block-editor]") == null);
    expect(groupIds(view.root)).toEqual(["work", "view", "document"]);
  });

  it("Given the retired toggle pressed twice, Then it reads as pressed and then as released", async () => {
    const view = await mount();
    await view.userEvent('[data-bar-action="retired-blocks"]', "click");
    await view.settle(
      () => bar(view.root, "retired-blocks")?.getAttribute("aria-pressed") === "true",
    );
    await view.userEvent('[data-bar-action="retired-blocks"]', "click");
    await view.settle(
      () => bar(view.root, "retired-blocks")?.getAttribute("aria-pressed") === "false",
    );
  });

  it("Given Delete pressed, Then it asks first, naming the document, and deletes nothing yet", async () => {
    const view = await mount();
    await view.userEvent('[data-bar-action="delete-document"]', "click");
    await view.settle(() => (view.record.messages?.length ?? 0) === 1);
    expect(view.record.messages).toEqual(["Delete “Bar”?"]);
    expect(view.sent.filter((command) => command.body["command"] === "delete")).toEqual([]);
  });

  it("Given the Standing choice on the bar, Then it offers the whole scale with the block's standing chosen, and a choice is written", async () => {
    const view = await mount();
    await activate(view, "blk-a");
    const select = () =>
      (view.root.querySelector('[data-bar-action="block-standing"]') as HTMLSelectElement | null) ?? null;
    const options = Array.from(select()?.options ?? []);
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "discarded",
      "keep",
      "fixate",
    ]);
    // Asserted by attribute: this DOM leaves `option.selected` undefined
    // (`BO_0224`).
    expect(
      options.filter((option) => option.hasAttribute("selected")).map((option) => option.getAttribute("value")),
    ).toEqual(["keep"]);
    select()!.value = "fixate";
    await view.userEvent(select()!, "change");
    await view.settle(() =>
      view.sent.some((command) => command.body["command"] === "setDisposition"),
    );
    expect(
      view.sent.find((command) => command.body["command"] === "setDisposition")?.body,
    ).toMatchObject({ blockId: "blk-a", standing: "fixate" });
  });

  it("Given the link toggle pressed, Then the address field joins the format group with Apply link beside it", async () => {
    const view = await mount();
    await activate(view, "blk-b");
    expect(view.root.querySelector('[data-bar-action="block-link-address"]') ?? null).toBeNull();
    await view.userEvent('[data-bar-action="block-link"]', "click");
    await view.settle(
      () => view.root.querySelector('[data-bar-action="block-link-address"]') != null,
    );
    const field = view.root.querySelector(
      '[data-bar-group="format"] [data-bar-action="block-link-address"]',
    ) as HTMLInputElement | null;
    expect(field?.getAttribute("type")).toBe("url");
    expect(
      view.root.querySelector('[data-bar-group="format"] [data-field-submit="block-link-address"]')?.textContent,
    ).toBe("Apply link");
  });

  /**
   * What a standing means, beside the control that sets it: the popover is
   * contributed with the *Standing* group, so it is drawn when that control
   * is. This replaces *wherever the bar stands* (`BO_0272_009`), which put it
   * in a group of its own. DO_0010_005
   */
  it("Given a block focused, Then the info control says the three states and how each is set", async () => {
    const view = await mount();
    await activate(view, "blk-a");
    const control = () =>
      (view.root.querySelector('[data-bar-action="standing-info"]') as HTMLElement | null) ?? null;
    expect(control()?.getAttribute("aria-label")).toBe("What a standing means");
    expect(control()?.getAttribute("aria-expanded")).toBe("false");

    await view.userEvent('[data-bar-action="standing-info"]', "click");
    const panel = view.root.querySelector('[data-popover-panel="standing-info"]') as HTMLElement | null;
    const terms = Array.from(panel?.querySelectorAll("dt") ?? []).map((term) => term.textContent);
    expect(terms).toEqual(["Discard", "Keep", "Fixate", "Setting one"]);
    const said = Array.from(panel?.querySelectorAll("dd") ?? []).map((line) => line.textContent ?? "");
    // The reader's words and the run's say the same of each state: a fixated
    // block stands behind every command in its document.
    expect(said[2]).toContain("every command you give in this document");
    expect(said[0]).toContain("leaves the page");
    expect(said[3]).toContain("Alt+Shift");
    await view.idle();
  });
});

/**
 * The bar before editing (`DO_0006_006`): the groups that act on the whole
 * block come up as soon as the reader turns to one, and only the inline
 * formatting waits for the caret. A proposal is worked with as a block and a
 * press accepts it first; a revealed discarded row is a subject and a
 * revealed retired row is not.
 */
const withStandings: DocumentView = {
  documentId: "doc-bar",
  revisionId: "rev-doc",
  title: "Bar",
  blocks: [
    ...draft.blocks,
    {
      kind: "text",
      blockId: "blk-d",
      revisionId: "rev-d",
      containmentId: "c-d",
      order: "d",
      role: "paragraph",
      standing: "discarded",
      runs: [{ text: "Set aside." }],
    },
  ],
};

const retired: BlockView[] = [
  {
    kind: "text",
    blockId: "blk-r",
    revisionId: "rev-r",
    containmentId: "c-r",
    order: "r",
    role: "paragraph",
    standing: "keep",
    runs: [{ text: "Taken out." }],
  },
];

const insert = "node:run-claude|insert|node:blk-n";

const proposals: DocumentProposals = {
  documentId: "doc-bar",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" },
      items: [
        {
          itemId: insert,
          groupId: "node:run-claude",
          kind: "insert",
          blockId: "blk-n",
          block: {
            kind: "text",
            blockId: "blk-n",
            revisionId: "rev-n",
            containmentId: "c-n",
            order: "ab",
            role: "paragraph",
            standing: "keep",
            runs: [{ text: "A new thought." }],
          },
        },
      ],
    },
  ],
};

const mountFull = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(withStandings, sent, { proposals, retired }));
  const harness = await mountEditor(withStandings);
  last = harness;
  return { ...harness, sent };
};

/** Turns to a row without editing it, as a phone's first tap does. A block
 * row answers `focus`; a proposal and a discarded row answer `focusin`, which
 * is what bubbles from the control the reader actually reached. */
const turnTo = async (
  view: Awaited<ReturnType<typeof mount>> | Awaited<ReturnType<typeof mountFull>>,
  selector: string,
  event: "focus" | "focusin" = "focus",
) => {
  await view.userEvent(selector, event);
  await view.settle();
};

describe("the bar before editing", () => {
  it("Given a block focused and not edited, Then the block groups act on it and Format and History wait for the caret", async () => {
    const view = await mount();
    await turnTo(view, '[data-block-id="blk-b"] [data-block-reading]');
    expect(groupIds(view.root)).toEqual([
      "work",
      "view",
      "turn-into",
      "block",
      "standing",
      "document",
    ]);
    expect(bar(view.root, "block-retire")?.getAttribute("aria-label")).toBe(
      "Retire block 2",
    );
    expect(bar(view.root, "mark-bold") ?? null).toBeNull();
    expect(bar(view.root, "block-undo") ?? null).toBeNull();
  });

  it("Given a focused block, When the plus is pressed, Then a paragraph is inserted directly below it", async () => {
    const view = await mount();
    await turnTo(view, '[data-block-id="blk-a"] [data-block-reading]');
    await view.userEvent('[data-bar-action="block-add-paragraph"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "insert"));
    // Between its key and the next one: directly below it. DO_0016_003
    expect(view.sent.find((command) => command.body["command"] === "insert")?.body).toMatchObject({
      placement: { between: ["a", "b"] },
    });
  });

  it("Given a focused block, Then the block controls are icons in one settled order", async () => {
    const view = await mount();
    await turnTo(view, '[data-block-id="blk-b"] [data-block-reading]');
    // Format leads and History trails the four; the role, the plus, the
    // archive and the standing with its *i* stand between them. DO_0010_002
    expect(
      Array.from(
        view.root.querySelectorAll(
          '[data-bar-group="turn-into"] [data-bar-action], [data-bar-group="block"] [data-bar-action], [data-bar-group="standing"] [data-bar-action]',
        ),
      ).map((control) => control.getAttribute("data-bar-action")),
    ).toEqual(["block-role", "block-add-paragraph", "block-add-table", "block-add-equation", "block-add-code", "block-import-table", "block-retire", "block-standing", "standing-info"]);
    // Each says what it is by its symbol, and carries its words as its name.
    expect(
      ["block-add-paragraph", "block-add-table", "block-add-equation", "block-import-table", "block-retire"].map((id) => ({
        icon: bar(view.root, id)?.querySelector("[data-icon]")?.getAttribute("data-icon"),
        name: bar(view.root, id)?.getAttribute("aria-label"),
      })),
    ).toEqual([
      { icon: "plus", name: "Insert paragraph after block 2" },
      { icon: "table", name: "Insert table after block 2" },
      { icon: "equals", name: "Insert equation after block 2" },
      { icon: "upload-simple", name: "Import a .csv or .tsv table after block 2" },
      { icon: "archive", name: "Retire block 2" },
    ]);
    // Nothing in the bar inserts a divider. DO_0010_003
    expect(bar(view.root, "block-add-divider") ?? null).toBeNull();
    expect(view.root.textContent).not.toContain("Divider");
  });

  it("Given a focused block, Then the role and the standing wear the mark of what they hold", async () => {
    const view = await mount();
    await turnTo(view, '[data-block-id="blk-b"] [data-block-reading]');
    // A paragraph and a kept block: the symbol of each option is on it, and
    // the current one is what the bar draws. DO_0010_002 DO_0010_004
    const iconOf = (id: string) =>
      view.root
        .querySelector(`[data-choice="${id}"] [data-icon]`)
        ?.getAttribute("data-icon") ?? null;
    expect([iconOf("block-role"), iconOf("block-standing")]).toEqual([
      "article-ny-times",
      "circle",
    ]);
    // Every option names its own symbol, so the control wears whichever
    // state the block comes to stand in, and every text role names one too.
    expect(
      Array.from(
        view.root.querySelectorAll('[data-choice="block-standing"] option'),
      ).map((option) => option.getAttribute("value")),
    ).toEqual(["discarded", "keep", "fixate"]);
  });

  it("Given a focused block, Then the standing explanation stands beside the control it explains", async () => {
    const view = await mount();
    // With nothing focused the explanation is not drawn: it says what the
    // control beside it does, and that control is not there. DO_0010_005
    expect(bar(view.root, "standing-info") ?? null).toBeNull();
    await turnTo(view, '[data-block-id="blk-b"] [data-block-reading]');
    const info = bar(view.root, "standing-info");
    expect(info?.closest("[data-bar-group]")?.getAttribute("data-bar-group")).toBe("standing");
    expect(info?.getAttribute("aria-expanded")).toBe("false");
    await view.userEvent('[data-bar-action="standing-info"]', "click");
    await view.settle(() => bar(view.root, "standing-info")?.getAttribute("aria-expanded") === "true");
    expect(
      view.root.querySelector('[data-popover-panel="standing-info"]')?.textContent,
    ).toContain("Discard");
  });

  it("Given a document read, Then the two acts that decide what it is lead the bar", async () => {
    const view = await mount();
    // *Work in a proposal* is the view's own; `calliopa-refine`'s
    // *Establish…* joins this same group through the decoration bar, which
    // is why the group is the view's and leads. DO_0010_001
    const work = view.root.querySelector('[data-bar-group="work"]');
    expect(work?.getAttribute("aria-label")).toBe("Work");
    expect(
      Array.from(work?.querySelectorAll("[data-bar-action]") ?? []).map((control) => ({
        id: control.getAttribute("data-bar-action"),
        icon: control.querySelector("[data-icon]")?.getAttribute("data-icon"),
      })),
    ).toEqual([
      { id: "work-in-proposal", icon: "git-branch" },
      { id: "establish", icon: "lighthouse" },
    ]);
    // It is no longer in the trailing group, which keeps the two acts on the
    // document itself.
    expect(
      Array.from(
        view.root.querySelectorAll('.view-bar__trailing [data-bar-action]'),
      ).map((control) => control.getAttribute("data-bar-action")),
    ).toEqual(["take-back-standing", "delete-document"]);
  });

  it("Given a focused block, When its role is turned, Then it is revised from the revision the document holds", async () => {
    const view = await mount();
    await turnTo(view, '[data-block-id="blk-b"] [data-block-reading]');
    const select = () =>
      (view.root.querySelector('[data-bar-action="block-role"]') as HTMLSelectElement | null) ?? null;
    select()!.value = "heading";
    await view.userEvent(select()!, "change");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "revise"));
    expect(view.sent.find((command) => command.body["command"] === "revise")?.body).toMatchObject({
      blockId: "blk-b",
      baseRevisionId: "rev-b",
      role: "heading",
    });
  });

  it("Given a focused block, When Code is chosen in Turn into, Then it is turned into a code block in its place", async () => {
    // BO_0289_021: the words become a code block and the text block is
    // retired, one write on the revision the document holds.
    const view = await mount();
    await turnTo(view, '[data-block-id="blk-b"] [data-block-reading]');
    const select = () =>
      (view.root.querySelector('[data-bar-action="block-role"]') as HTMLSelectElement | null) ?? null;
    expect([...view.root.querySelectorAll('[data-bar-action="block-role"] option')].map((option) => option.getAttribute("value"))).toContain("code");
    select()!.value = "code";
    await view.userEvent(select()!, "change");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "turnIntoCode"));
    expect(view.sent.find((command) => command.body["command"] === "turnIntoCode")?.body).toMatchObject({
      blockId: "blk-b",
      baseRevisionId: "rev-b",
    });
    expect(view.sent.some((command) => command.body["command"] === "revise")).toBe(false);
  });

  it("Given a focused block, When a standing is chosen, Then it is written on that block", async () => {
    const view = await mount();
    await turnTo(view, '[data-block-id="blk-b"] [data-block-reading]');
    const select = () =>
      (view.root.querySelector('[data-bar-action="block-standing"]') as HTMLSelectElement | null) ?? null;
    select()!.value = "fixate";
    await view.userEvent(select()!, "change");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "setDisposition"));
    expect(
      view.sent.find((command) => command.body["command"] === "setDisposition")?.body,
    ).toMatchObject({ blockId: "blk-b", standing: "fixate" });
  });

  it("Given a block being edited, When the pointer rests on another row, Then the bar keeps naming the block being edited", async () => {
    const view = await mount();
    await activate(view, "blk-a");
    await view.userEvent('[data-block-id="blk-b"]', "pointerenter", { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await view.settle();
    expect(groupIds(view.root)).toEqual([
      "work",
      "view",
      "format",
      "turn-into",
      "block",
      "standing",
      "history",
      "document",
    ]);
    expect(bar(view.root, "block-retire")?.getAttribute("aria-label")).toBe("Retire block 1");
    expect(view.root.querySelector("[data-block-editor]")).not.toBeNull();
  });

  it("Given a revealed discarded row focused, Then the block groups come up with its standing", async () => {
    const view = await mountFull();
    await view.userEvent('[data-bar-action="discarded-blocks"]', "click");
    await view.settle(() => view.root.querySelector("[data-discarded-id]") !== null);
    await turnTo(view, '[data-discarded-id="blk-d"] .discarded-row__text', "focusin");
    expect(groupIds(view.root)).toEqual(["work", "view", "turn-into", "block", "standing", "document"]);
    expect(bar(view.root, "block-retire")?.getAttribute("aria-label")).toBe("Retire block 3");
    const select = view.root.querySelector('[data-bar-action="block-standing"]') as HTMLSelectElement | null;
    expect(
      Array.from(select?.options ?? [])
        .filter((option) => option.hasAttribute("selected"))
        .map((option) => option.getAttribute("value")),
    ).toEqual(["discarded"]);
    // Every kind of row the bar can act on carries the focused row's ring.
    // DO_0006_012
    expect(
      view.root.querySelector('[data-discarded-id="blk-d"]')?.getAttribute("data-focused"),
    ).toBe("true");
  });

  it("Given a revealed retired row focused, Then only the Add controls come up, and a paragraph goes directly below it", async () => {
    const view = await mountFull();
    await view.userEvent('[data-bar-action="retired-blocks"]', "click");
    await view.settle(() => view.root.querySelector("[data-retired-id]") !== null);
    await turnTo(view, '[data-retired-id="blk-r"] .retired-row__text', "focusin");
    // Out of the document's flow: a new block can go below it, and that is
    // all. DO_0016_005
    expect(groupIds(view.root)).toEqual(["work", "view", "block", "document"]);
    expect(bar(view.root, "block-retire")).toBeNull();
    expect(bar(view.root, "block-add-paragraph")?.getAttribute("aria-label")).toBe(
      "Insert paragraph after the retired block",
    );
    expect(view.root.querySelector('[data-retired-id="blk-r"]')?.getAttribute("data-focused")).toBe("true");
    await view.userEvent('[data-bar-action="block-add-paragraph"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "insert"));
    expect(view.sent.find((command) => command.body["command"] === "insert")?.body).toMatchObject({
      placement: { between: ["r", null] },
    });
  });

  it("Given a revealed discarded row focused, When the plus is pressed, Then a paragraph goes directly below it", async () => {
    const view = await mountFull();
    await view.userEvent('[data-bar-action="discarded-blocks"]', "click");
    await view.settle(() => view.root.querySelector("[data-discarded-id]") !== null);
    await turnTo(view, '[data-discarded-id="blk-d"] .discarded-row__text', "focusin");
    await view.userEvent('[data-bar-action="block-add-paragraph"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "insert"));
    expect(view.sent.find((command) => command.body["command"] === "insert")?.body).toMatchObject({
      placement: { between: ["d", null] },
    });
  });

  it("Given a proposal focused, When the plus is pressed, Then the proposal stays open and a paragraph goes directly below it", async () => {
    const view = await mountFull();
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
    await turnTo(view, `[data-proposal-id="${insert}"]`, "focusin");
    await view.userEvent('[data-bar-action="block-add-paragraph"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "insert"));
    // Nothing is answered: adding below a proposal leaves it open. DO_0016_003
    expect(view.sent.some((command) => command.body["command"] === "answerProposal")).toBe(false);
    // The proposal sits between blk-a and blk-b at "ab"; the paragraph goes
    // between it and blk-b, so it reads below it whether it is accepted or not.
    expect(view.sent.find((command) => command.body["command"] === "insert")?.body).toMatchObject({
      placement: { between: ["ab", "b"] },
    });
  });

  it("Given proposals hidden, When the plus is pressed on the block above one, Then the hidden proposal still follows the new paragraph", async () => {
    const view = await mountFull();
    await view.settle(() => true);
    expect(view.root.querySelector("[data-proposal-id]") ?? null).toBeNull();
    await turnTo(view, '[data-block-id="blk-a"] [data-block-reading]');
    await view.userEvent('[data-bar-action="block-add-paragraph"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "insert"));
    // Below what the reader sees, and above the proposal they hid, so it is
    // drawn after the new block once shown. DO_0016_001
    expect(view.sent.find((command) => command.body["command"] === "insert")?.body).toMatchObject({
      placement: { between: ["a", "ab"] },
    });
  });

  it("Given a proposal focused, When Retire is pressed, Then the proposal is accepted first and the block it became is retired", async () => {
    const view = await mountFull();
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
    await turnTo(view, `[data-proposal-id="${insert}"]`, "focusin");
    expect(groupIds(view.root)).toEqual(["work", "view", "turn-into", "block", "standing", "document"]);
    expect(bar(view.root, "block-retire")?.getAttribute("aria-label")).toBe(
      "Retire the proposed block",
    );
    await view.userEvent('[data-bar-action="block-retire"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "retire"));
    const commands = view.sent.map((command) => String(command.body["command"]));
    expect(commands.indexOf("answerProposal")).toBeGreaterThanOrEqual(0);
    expect(commands.indexOf("answerProposal")).toBeLessThan(commands.indexOf("retire"));
    expect(view.sent.find((command) => command.body["command"] === "retire")?.body).toMatchObject({
      blockId: "blk-n",
    });
  });
});
