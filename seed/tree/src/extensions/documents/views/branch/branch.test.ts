import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import type { BranchRead, Standing } from "../../lib/branch";
import { leaveBranch } from "../../lib/branch-scope";
import { SAVE_PAUSE_MS } from "../block-editor";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * Proposal sessions in the editor (`BO_0250_020`–`BO_0250_022`, `CA_0057`),
 * pressed in Qwik's render harness through the editor's own JSX: *Work in a
 * proposal* is a toggle in the bar's *Document* group on any document a person
 * can edit and not on a change document; pressing it enters a new session,
 * reading the document through its overlay and sending every command into
 * it, and pressing it again returns to truth. Each open session is a chip:
 * its press works in it, its *Accept all* reads the standing and asks no run
 * — a drifted member is kept or dropped on the card before *Accept* stands —
 * and its *Reject all* lists what it held under the title, promotable on its
 * own. Nothing stands under the title otherwise.
 */

const words = (text: string) => [{ text }];

const plain: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Caching",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: words("Opening.") },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: words("Request-local caching could reduce repeated checks.") },
  ],
} as DocumentView;

const BRANCH = "node:branch-doc-1-alice";
const NEXT = "node:branch-doc-1-alice.2";
/** 14:32 local time, the session's start as its chip says it. */
const SINCE = new Date(2026, 8, 18, 14, 32).getTime();
/** The branch read with BRANCH open as a session: the next session is NEXT. */
const OPEN: BranchRead = { branch: NEXT, sessions: [{ branch: BRANCH, since: SINCE }] };

const branchProposals = (): DocumentProposals =>
  ({
    documentId: "doc-1",
    unanswered: 3,
    groups: [
      {
        groupId: BRANCH,
        stagedBy: ["alice"],
        proposer: { kind: "person", name: "alice" },
        items: [
          {
            itemId: `${BRANCH}|replace|node:blk-a`,
            groupId: BRANCH,
            kind: "replace",
            blockId: "blk-a",
            block: { ...plain.blocks[0], runs: words("Opening, revised in the branch.") },
          },
          {
            itemId: `${BRANCH}|replace|node:blk-b`,
            groupId: BRANCH,
            kind: "replace",
            blockId: "blk-b",
            block: { ...plain.blocks[1], runs: words("Request-local caching, revised in the branch.") },
          },
          {
            itemId: `${BRANCH}|insert|node:blk-c`,
            groupId: BRANCH,
            kind: "insert",
            blockId: "blk-c",
            block: { kind: "text", blockId: "blk-c", revisionId: "rev-c", containmentId: "c-c", order: "c", role: "paragraph", standing: "keep", runs: words("Added in the branch.") },
          },
        ],
      },
    ],
  }) as unknown as DocumentProposals;

const standingOf = (members: Standing["members"]): Standing => ({ proposal: BRANCH, status: "open", base: 10, head: 12, members });

afterEach(() => {
  leaveBranch("doc-1");
  vi.unstubAllGlobals();
});

const mount = async (
  document: DocumentView = plain,
  options: {
    readonly branch?: BranchRead;
    readonly proposals?: DocumentProposals;
    readonly standing?: Standing | (() => Standing);
    readonly refuseAnswers?: boolean;
    readonly overlayDocuments?: Readonly<Record<string, DocumentView>>;
    readonly required?: boolean;
    readonly refuseTruthSaves?: boolean;
  } = {},
) => {
  const sent: SentCommand[] = [];
  const overlays: string[] = [];
  vi.stubGlobal(
    "fetch",
    documentsApi(document, sent, {
      overlays,
      branch: options.branch ?? { branch: BRANCH, sessions: [] },
      proposals: options.proposals ?? { documentId: "doc-1", unanswered: 0, groups: [] },
      ...(options.standing === undefined ? {} : { standing: options.standing }),
      ...(options.refuseAnswers === undefined ? {} : { refuseAnswers: options.refuseAnswers }),
      ...(options.overlayDocuments === undefined ? {} : { overlayDocuments: options.overlayDocuments }),
      ...(options.required === undefined ? {} : { required: options.required }),
      ...(options.refuseTruthSaves === undefined ? {} : { refuseTruthSaves: options.refuseTruthSaves }),
    }),
  );
  const view = await mountEditor(document);
  const toggle = () => view.root.querySelector('[data-bar-action="work-in-proposal"]') as HTMLElement | null;
  const pressed = () => toggle()?.getAttribute("aria-pressed") === "true";
  const card = () => view.root.querySelector("[data-branch-card]") as HTMLElement | null;
  const chips = () => (view.record.chips ?? []).filter((chip) => chip.session === true);
  // A flow of several reads and writes takes longer than the harness's own
  // settle allows; this waits as the handover tests do.
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 300; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  // A press lands on a quiet harness: its test platform refuses a frame
  // asked while another is pending, which a browser never does.
  const quiet = async () => {
    for (let tick = 0; tick < 20; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
    }
  };
  const press = async () => {
    await quiet();
    const was = pressed();
    await view.userEvent('[data-bar-action="work-in-proposal"]', "click");
    await waitFor(() => pressed() !== was);
  };
  /** A session chip's pencil, as the shell hands it over. */
  const work = async (group: string) => {
    await waitFor(() => chips().some((chip) => chip.key === group));
    view.record.toggleRun = group;
    view.record.toggleWork = true;
    await view.userEvent("[data-harness-toggle-run]", "click");
  };
  /** A session chip's own press, which shows or hides it. */
  const toggleChip = async (group: string) => {
    await waitFor(() => chips().some((chip) => chip.key === group));
    view.record.toggleRun = group;
    view.record.toggleWork = false;
    await view.userEvent("[data-harness-toggle-run]", "click");
  };
  /** A session chip's *Accept all* or *Reject all*. */
  const answerAll = async (group: string, answer: "accepted" | "rejected") => {
    await waitFor(() => chips().some((chip) => chip.key === group));
    view.record.answerAll = { group, answer };
    await view.userEvent("[data-harness-answer-all]", "click");
  };
  const openCard = async () => {
    await answerAll(BRANCH, "accepted");
    await waitFor(() => card() != null && card()?.getAttribute("data-branch-card") !== "waiting");
  };
  const edit = async (blockId: string, text: string) => {
    await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "focus");
    await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "keydown", { key: "Enter" });
    await waitFor(() => view.root.querySelector("[data-block-editor]") != null);
    const editor = view.root.querySelector("[data-block-editor]") as HTMLElement;
    editor.textContent = text;
    await view.userEvent(editor, "input");
  };
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name);
  // An answer ends in reads of the document, its proposals and the sessions,
  // which must land before the harness goes: a write after it is a failure
  // of its own.
  const settle = async () => {
    for (let tick = 0; tick < 30; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
    }
    await view.settle();
  };
  return { ...view, settle, sent, overlays, toggle, pressed, card, chips, press, work, toggleChip, answerAll, openCard, edit, commands, waitFor };
};

describe("the proposal toggle", () => {
  it("Given a document, Then the Work group leads with the toggle and Establish…, the Document group trails with Take back and Delete, and nothing stands under the title; given a change document, there is no toggle", async () => {
    const view = await mount();
    await view.waitFor(() => view.toggle() != null);
    const actions = (id: string) =>
      [
        ...(view.root.querySelector(`[data-bar-group="${id}"]`) as HTMLElement).querySelectorAll(
          "[data-bar-action]",
        ),
      ].map((action) => action.getAttribute("data-bar-action"));
    // The two acts that decide what the document is lead the bar, the
    // toggle first and the decision extension's *Establish…* merged in after
    // it through the decoration bar. DO_0010_001 DO_0010_013 BO_0274_004
    expect(actions("work")).toEqual(["work-in-proposal", "establish"]);
    // *Take back* leads the trailing group: it is drawn whenever the bar is,
    // since a standing is most often set on a block that is not active.
    // CA_0058_011
    expect(actions("document")).toEqual(["format-code", "line-numbers", "take-back-standing", "delete-document"]);
    expect(view.toggle()?.getAttribute("aria-label") ?? view.toggle()?.textContent).toContain("Work in a proposal");
    expect(view.pressed()).toBe(false);
    expect(view.root.querySelector("[data-document-branch]")).toBeFalsy();
    await view.settle();
    vi.unstubAllGlobals();
    const change = await mount({ ...plain, change: "ui.shell", changeStatus: "draft" } as DocumentView);
    await change.waitFor(() => change.root.querySelector('[data-bar-group="document"]') != null);
    expect(change.toggle()).toBeFalsy();
    await change.settle();
  });

  it(
    "Given the toggle pressed, Then the tab reads through a session, the next save names it, and pressing again returns to truth",
    async () => {
      const view = await mount();
      expect(view.overlays.every((overlay) => overlay === "")).toBe(true);
      await view.press();
      expect(view.overlays).toContain(BRANCH);
      expect(view.record.branch).toBe(BRANCH);
      await view.edit("blk-a", "Opening, in the branch.");
      await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
      await view.userEvent(view.root, "harnessSettle");
      expect(view.commands("revise")[0]?.body["branch"]).toBe(BRANCH);
      await view.press();
      expect(view.overlays[view.overlays.length - 1]).toBe("");
      expect(view.record.branch).toBeNull();
      // The next save after leaving is truth's: no branch on the command,
      // based on the revision truth holds. Found live in the BO_0250
      // walk-through, 2026-09-15.
      await view.edit("blk-a", "Opening, in truth again.");
      await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
      await view.userEvent(view.root, "harnessSettle");
      const saves = view.commands("revise");
      expect(saves).toHaveLength(2);
      expect(saves[1]?.body["branch"]).toBeUndefined();
      expect(saves[1]?.body["baseRevisionId"]).toBe("rev-a");
      await view.settle();
    },
    SAVE_PAUSE_MS * 2 + 9000,
  );

  it("Given a session open, Then its chip reads Proposal · yours and its time, and the toggle starts a new session beside it", async () => {
    const view = await mount(plain, { branch: OPEN, proposals: branchProposals() });
    await view.waitFor(() => view.chips().length === 1);
    expect(view.chips()[0]).toMatchObject({ key: BRANCH, group: BRANCH, text: "Proposal · yours · 14:32", ended: true, shown: false });
    expect(view.chips()[0]?.accepts).toBeUndefined();
    await view.press();
    expect(view.record.branch).toBe(NEXT);
    expect(view.overlays).toContain(NEXT);
    expect(view.chips().map((chip) => [chip.key, chip.shown])).toEqual([[BRANCH, false]]);
    await view.settle();
  });

  it("Given a session chip's pencil pressed, Then the tab works in that session with the toggle pressed, and a second press leaves it", async () => {
    const view = await mount(plain, { branch: OPEN, proposals: branchProposals() });
    await view.work(BRANCH);
    await view.waitFor(() => view.record.branch === BRANCH && view.pressed());
    expect(view.overlays).toContain(BRANCH);
    await view.waitFor(() => view.chips()[0]?.shown === true && view.chips()[0]?.working === true);
    // The chip's own press does not hide the session the tab works in.
    await view.toggleChip(BRANCH);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(view.chips()[0]?.shown).toBe(true);
    await view.work(BRANCH);
    await view.waitFor(() => view.record.branch === null && !view.pressed());
    await view.waitFor(() => view.chips()[0]?.working === false);
    await view.settle();
  });

  it("Given two sessions and a run, Then each chip's press moves the expansion to its own proposals, while the tab works in neither", async () => {
    const SECOND = "node:branch-doc-1-alice.2";
    const base = branchProposals();
    const second = {
      groupId: SECOND,
      stagedBy: ["alice"],
      proposer: { kind: "person", name: "alice" },
      items: [{ itemId: `${SECOND}|insert|node:blk-d`, groupId: SECOND, kind: "insert", blockId: "blk-d", block: { kind: "text", blockId: "blk-d", revisionId: "rev-d", containmentId: "c-d", order: "d", role: "paragraph", standing: "keep", runs: words("Added in the second session.") } }],
    };
    const run = {
      groupId: "node:run-1",
      stagedBy: ["claude"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "" },
      run: { runId: "run-1", stagedAt: 1 },
      items: [{ itemId: "node:run-1|replace|node:blk-b", groupId: "node:run-1", kind: "replace", blockId: "blk-b", block: { ...plain.blocks[1], runs: words("A run's rewrite.") } }],
    };
    const proposals = { ...base, unanswered: 5, groups: [...base.groups, second, run] } as unknown as DocumentProposals;
    const view = await mount(plain, { branch: { branch: "node:branch-doc-1-alice.3", sessions: [{ branch: BRANCH, since: SINCE }, { branch: SECOND, since: SINCE + 60_000 }] }, proposals });
    const rows = () => [...view.root.querySelectorAll("[data-proposal-id]")].map((row) => (row.getAttribute("data-proposal-id") ?? "").split("|")[0]);
    await view.waitFor(() => view.chips().length === 2);
    expect(view.chips().every((chip) => !chip.shown && !chip.working)).toBe(true);
    // From the second chip on, one change is read at a time: a press expands
    // its own and collapses whatever was open. CA_0061_008
    await view.toggleChip(BRANCH);
    await view.waitFor(() => rows().includes(BRANCH));
    await view.toggleChip(SECOND);
    await view.waitFor(() => rows().includes(SECOND));
    expect(rows()).not.toContain(BRANCH);
    view.record.toggleRun = "node:run-1";
    view.record.toggleWork = false;
    await view.userEvent("[data-harness-toggle-run]", "click");
    await view.waitFor(() => rows().includes("node:run-1"));
    expect(rows()).not.toContain(SECOND);
    expect(view.chips().map((chip) => [chip.key, chip.shown])).toEqual([[SECOND, false], [BRANCH, false]]);
    expect(view.record.branch ?? null).toBeNull();
    // Its own press collapses it, and nothing is drawn. CA_0061_008
    await view.userEvent("[data-harness-toggle-run]", "click");
    await view.waitFor(() => !rows().includes("node:run-1"));
    expect(rows()).toEqual([]);
    await view.settle();
  });

  it("Given the tab in a session with the proposals shown, Then the session's own items are the document, never proposal blocks", async () => {
    const withRun = branchProposals();
    const other = {
      groupId: "node:run-1",
      stagedBy: ["claude"],
      proposer: { kind: "agent", name: "Claude Code" },
      items: [
        {
          itemId: "node:run-1|replace|node:blk-b",
          groupId: "node:run-1",
          kind: "replace",
          blockId: "blk-b",
          block: { ...plain.blocks[1], runs: words("A run's rewrite.") },
        },
      ],
    };
    const proposals = { ...withRun, unanswered: 4, groups: [...withRun.groups, other] } as unknown as DocumentProposals;
    const view = await mount(plain, { branch: OPEN, proposals });
    await view.work(BRANCH);
    await view.waitFor(() => view.record.branch === BRANCH);
    // The bar's toggle, pressed as a reader presses it.
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.waitFor(() => view.root.querySelector("[data-proposal-id]") != null);
    const shown = [...view.root.querySelectorAll("[data-proposal-id]")].map((row) => row.getAttribute("data-proposal-id") ?? "");
    expect(shown.some((id) => id.startsWith("node:run-1"))).toBe(true);
    expect(shown.some((id) => id.startsWith(BRANCH))).toBe(false);
    await view.settle();
  });
});

describe("the acceptance card", () => {
  it("Given no member drifted, Then Accept all answers every member at once and leaves the session, with no reconcile", async () => {
    const view = await mount(plain, {
      branch: OPEN,
      proposals: branchProposals(),
      standing: standingOf([
        { ref: "node:blk-a", kind: "node", standing: "clean" },
        { ref: "node:blk-b", kind: "node", standing: "clean" },
        { ref: "node:blk-c", kind: "node", standing: "autoCorrected" },
      ]),
    });
    await view.answerAll(BRANCH, "accepted");
    await view.waitFor(() => view.commands("answerProposal").length === 3 && view.record.branch === null);
    expect(view.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"], command.body["edited"]])).toEqual([
      [`${BRANCH}|replace|node:blk-a`, "accepted", undefined],
      [`${BRANCH}|replace|node:blk-b`, "accepted", undefined],
      [`${BRANCH}|insert|node:blk-c`, "accepted", undefined],
    ]);
    expect(view.sent.some((command) => command.url.endsWith("/reconcile"))).toBe(false);
    expect(view.card()).toBeFalsy();
    await view.settle();
  });

  it("Given drifted members, Then Accept all opens the card, and Accept waits until each is kept or dropped, then keeps one over its drift and rejects the other", async () => {
    const view = await mount(plain, {
      branch: OPEN,
      proposals: branchProposals(),
      standing: standingOf([
        { ref: "node:blk-a", kind: "node", standing: "drifted" },
        { ref: "node:blk-b", kind: "node", standing: "drifted" },
        { ref: "node:blk-c", kind: "node", standing: "clean" },
      ]),
    });
    await view.openCard();
    expect(view.card()?.getAttribute("data-branch-card")).toBe("open");
    expect(view.commands("answerProposal")).toHaveLength(0);
    expect(view.card()?.querySelector("[data-branch-establish]")).toBeFalsy();
    expect(view.card()?.querySelector("[data-branch-note]")?.textContent).toContain("Keep your words");
    await view.userEvent('[data-branch-keep="node:blk-a"]', "click");
    await view.waitFor(() => view.card()?.querySelector('[data-branch-member="node:blk-a"]')?.getAttribute("data-member-choice") === "keep");
    expect(view.card()?.querySelector("[data-branch-establish]")).toBeFalsy();
    await view.userEvent('[data-branch-drop="node:blk-b"]', "click");
    await view.waitFor(() => view.card()?.querySelector("[data-branch-establish]") != null);
    await view.userEvent("[data-branch-establish]", "click");
    await view.waitFor(() => view.record.branch === null);
    expect(view.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"], command.body["edited"]])).toEqual([
      [`${BRANCH}|replace|node:blk-a`, "accepted", true],
      [`${BRANCH}|replace|node:blk-b`, "rejected", undefined],
      [`${BRANCH}|insert|node:blk-c`, "accepted", undefined],
    ]);
    await view.settle();
  });

  it("Given a drifted member rewritten in the session, Then Not yet closes the card, and the next Accept all reads the standing again and accepts", async () => {
    let reads = 0;
    const view = await mount(plain, {
      branch: OPEN,
      proposals: branchProposals(),
      standing: () => standingOf([{ ref: "node:blk-a", kind: "node", standing: reads++ === 0 ? "drifted" : "clean" }]),
    });
    await view.openCard();
    expect(view.card()?.querySelector("[data-branch-establish]")).toBeFalsy();
    await view.userEvent("[data-branch-not-yet]", "click");
    await view.waitFor(() => view.card() == null);
    expect(view.record.branch).toBe(BRANCH);
    await view.answerAll(BRANCH, "accepted");
    await view.waitFor(() => view.commands("answerProposal").length > 0 && view.record.branch === null);
    await view.settle();
  });

  it("Given a run proposed into the session, Then its record is not listed on the card and is answered with the session on Accept all and on Reject all", async () => {
    const withRun = standingOf([
      { ref: "node:blk-a", kind: "node", standing: "drifted" },
      { ref: "node:run:arun-harness", kind: "node", standing: "clean" },
    ]);
    const view = await mount(plain, { branch: OPEN, proposals: branchProposals(), standing: withRun });
    await view.openCard();
    expect([...(view.card()?.querySelectorAll("[data-branch-member]") ?? [])].map((member) => member.getAttribute("data-branch-member"))).toEqual(["node:blk-a"]);
    await view.userEvent('[data-branch-keep="node:blk-a"]', "click");
    await view.waitFor(() => view.card()?.querySelector("[data-branch-establish]") != null);
    await view.userEvent("[data-branch-establish]", "click");
    await view.waitFor(() => view.record.branch === null);
    const accepted = view.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"]]);
    expect(accepted[accepted.length - 1]).toEqual([`${BRANCH}|run|node:run:arun-harness`, "accepted"]);
    await view.settle();
    vi.unstubAllGlobals();
    leaveBranch("doc-1");

    const again = await mount(plain, { branch: OPEN, proposals: branchProposals(), standing: withRun });
    await again.answerAll(BRANCH, "rejected");
    await again.waitFor(() => again.commands("answerProposal").length > 0 && again.record.branch === null);
    const rejected = again.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"]]);
    expect(rejected[rejected.length - 1]).toEqual([`${BRANCH}|run|node:run:arun-harness`, "rejected"]);
    await again.settle();
  });

  it("Given an answer refused, Then the card names it and stands", async () => {
    const view = await mount(plain, {
      branch: OPEN,
      proposals: branchProposals(),
      standing: standingOf([{ ref: "node:blk-a", kind: "node", standing: "clean" }]),
      refuseAnswers: true,
    });
    await view.answerAll(BRANCH, "accepted");
    await view.waitFor(() => view.card()?.querySelector("[data-branch-refusal]") != null);
    expect(view.record.branch).toBe(BRANCH);
    await view.settle();
  });
});

describe("a rejected session", () => {
  it("Given Reject all on a session chip, Then every member is rejected, the tab is in truth, and the rows list what it held with Promote this block on its own", async () => {
    const held: DocumentView = {
      ...plain,
      blocks: [
        plain.blocks[0] as DocumentView["blocks"][number],
        { ...(plain.blocks[1] as DocumentView["blocks"][number]), revisionId: "rev-b2", runs: words("Request-local caching, revised in the branch.") } as DocumentView["blocks"][number],
      ],
    };
    const view = await mount(plain, { branch: OPEN, proposals: branchProposals(), overlayDocuments: { [BRANCH]: held } });
    await view.answerAll(BRANCH, "rejected");
    await view.waitFor(() => view.root.querySelector("[data-branch-rejected]") != null);
    expect(view.record.branch).toBeNull();
    expect(view.pressed()).toBe(false);
    expect(view.commands("answerProposal").map((command) => command.body["answer"])).toEqual(["rejected", "rejected", "rejected"]);
    const row = view.root.querySelector('[data-rejected-block="blk-b"]');
    expect(row?.textContent).toContain("revised in the branch");
    await view.userEvent('[data-branch-promote="blk-b"]', "click");
    await view.waitFor(() => view.commands("promoteBlock").length === 1);
    expect(view.commands("promoteBlock")[0]?.body).toMatchObject({ group: BRANCH, blockId: "blk-b" });
    await view.waitFor(() => view.root.querySelector("[data-branch-rejected]") == null);
    await view.settle();
  });
});

/**
 * Separation of duties in the editor (`BO_0212_011`–`_013`, `CA_0057_010`,
 * `CA_0057_013`): under a policy on documents the document opens in truth; an
 * edit made there is refused by the core, and the tab enters a new session
 * and makes it again there; leaving stays possible; the person's own session
 * chip offers no *Accept all*.
 */
describe("separation of duties", () => {
  it(
    "Given documents under the policy, Then the document opens in truth, an edit starts a session, and the chip says someone else accepts it",
    async () => {
      const view = await mount(plain, { branch: OPEN, required: true, refuseTruthSaves: true, proposals: branchProposals() });
      await view.waitFor(() => view.chips()[0]?.accepts === "others");
      expect(view.record.branch ?? null).toBeNull();
      expect(view.pressed()).toBe(false);
      await view.edit("blk-a", "Opening, reviewed.");
      await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
      await view.waitFor(() => view.commands("revise").length >= 2);
      const saves = view.commands("revise");
      expect(saves[0]?.body["branch"]).toBeUndefined();
      expect(saves[1]?.body["branch"]).toBe(NEXT);
      expect(view.pressed()).toBe(true);
      expect(view.root.textContent).toContain("Documents are reviewed by someone else: your edits go into a proposal.");
      await view.settle();
    },
    SAVE_PAUSE_MS + 9000,
  );

  it("Given documents under the policy, Then the toggle still enters a session and leaves it: leaving only stops editing", async () => {
    const view = await mount(plain, { branch: OPEN, required: true, proposals: branchProposals() });
    await view.waitFor(() => view.chips()[0]?.accepts === "others");
    await view.press();
    expect(view.record.branch).toBe(NEXT);
    await view.press();
    expect(view.record.branch).toBeNull();
    expect(view.overlays[view.overlays.length - 1]).toBe("");
    await view.settle();
  });

  it("Given no policy, Then the document opens in truth and a session chip offers Accept all", async () => {
    const view = await mount(plain, { branch: OPEN, proposals: branchProposals() });
    await view.waitFor(() => view.chips().length === 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await view.userEvent(view.root, "harnessSettle");
    expect(view.pressed()).toBe(false);
    expect(view.chips()[0]?.accepts).toBeUndefined();
    await view.settle();
  });

  it("Given a save refused because the policy came while the tab was open, Then the tab enters a session and the save is made again into it", async () => {
    const view = await mount(plain, { refuseTruthSaves: true });
    await view.edit("blk-a", "Opening, typed before the policy.");
    await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
    await view.waitFor(() => view.commands("revise").length >= 2);
    const saves = view.commands("revise");
    expect(saves[0]?.body["branch"]).toBeUndefined();
    expect(saves[1]?.body["branch"]).toBe(BRANCH);
    expect(saves[1]?.body["runs"]).toEqual(saves[0]?.body["runs"]);
    expect(view.pressed()).toBe(true);
    // The block still active took the retried save as its own: leaving it
    // writes nothing more.
    await view.userEvent('[data-bar-action="block-done"]', "click");
    await view.waitFor(() => view.root.querySelector("[data-block-editor]") == null);
    expect(view.commands("revise")).toHaveLength(2);
    await view.settle();
  });

  it("Given the refused save was the one made on leaving the block, Then what was typed is still saved into the session", async () => {
    // Found live in the BO_0212_013 walk: a press outside the block saved it
    // and let it go, so the retry found no active block and the text was lost.
    const view = await mount(plain, { refuseTruthSaves: true });
    await view.edit("blk-a", "Opening, typed before the policy.");
    await view.userEvent('[data-bar-action="block-done"]', "click");
    await view.waitFor(() => view.commands("revise").length >= 2);
    const saves = view.commands("revise");
    expect(saves[0]?.body["branch"]).toBeUndefined();
    expect(saves[1]?.body["branch"]).toBe(BRANCH);
    expect(saves[1]?.body["runs"]).toEqual(saves[0]?.body["runs"]);
    expect(saves[1]?.body["baseRevisionId"]).toBe(saves[0]?.body["baseRevisionId"]);
    expect(view.pressed()).toBe(true);
    await view.settle();
  });
});
