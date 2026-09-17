import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import type { BranchRead, Standing } from "../../lib/branch";
import { leaveBranch } from "../../lib/branch-scope";
import { SAVE_PAUSE_MS } from "../block-editor";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * A proposal branch in the editor (`BO_0250_020`–`BO_0250_022`, `_025`),
 * pressed in Qwik's render harness through the editor's own JSX: *Work in a
 * proposal* stands on any document a person can edit and not on a change
 * document; entering the branch reads the document through its overlay and
 * sends every command into it, and leaving returns to truth; *Accept this
 * proposal* reads the standing and asks no run — a drifted member is kept or
 * dropped before *Accept* stands; a rejected branch lists what it held under
 * the line, promotable on its own.
 */

const words = (text: string) => [{ text }];

const plain: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Caching",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "neutral", runs: words("Opening.") },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "neutral", runs: words("Request-local caching could reduce repeated checks.") },
  ],
} as DocumentView;

const BRANCH = "node:branch-doc-1-alice";

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
            block: { kind: "text", blockId: "blk-c", revisionId: "rev-c", containmentId: "c-c", order: "c", role: "paragraph", standing: "neutral", runs: words("Added in the branch.") },
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
  } = {},
) => {
  const sent: SentCommand[] = [];
  const overlays: string[] = [];
  vi.stubGlobal(
    "fetch",
    documentsApi(document, sent, {
      overlays,
      branch: options.branch ?? { branch: BRANCH, status: "none" },
      proposals: options.proposals ?? { documentId: "doc-1", unanswered: 0, groups: [] },
      ...(options.standing === undefined ? {} : { standing: options.standing }),
      ...(options.refuseAnswers === undefined ? {} : { refuseAnswers: options.refuseAnswers }),
      ...(options.overlayDocuments === undefined ? {} : { overlayDocuments: options.overlayDocuments }),
    }),
  );
  const view = await mountEditor(document);
  const line = () => view.root.querySelector("[data-document-branch]") as HTMLElement | null;
  const card = () => view.root.querySelector("[data-branch-card]") as HTMLElement | null;
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
  const enter = async () => {
    await view.userEvent("[data-branch-enter]", "click");
    await waitFor(() => view.root.querySelector("[data-root-branch]") != null);
  };
  const openCard = async () => {
    await view.userEvent("[data-branch-accept]", "click");
    await waitFor(() => card()?.getAttribute("data-branch-card") !== "waiting" && card() != null);
  };
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name);
  return { ...view, sent, overlays, line, card, enter, openCard, commands, waitFor };
};

describe("the branch line", () => {
  it("Given a document with no phase, Then the line offers Work in a proposal; given a change document, there is no line", async () => {
    const view = await mount();
    expect(view.line()?.querySelector("[data-branch-enter]")?.textContent).toBe("Work in a proposal");
    expect(view.line()?.querySelector("[data-root-branch]")).toBeFalsy();
    await view.settle();
    vi.unstubAllGlobals();
    const change = await mount({ ...plain, change: "ui.shell", changeStatus: "draft" } as DocumentView);
    expect(change.line()).toBeFalsy();
    await change.settle();
  });

  it(
    "Given Work in a proposal pressed, Then the tab reads through the branch, the marker reads Proposal · yours, the next save names the branch, and leaving returns to truth",
    async () => {
      const view = await mount();
      expect(view.overlays.every((overlay) => overlay === "")).toBe(true);
      await view.enter();
      expect(view.line()?.querySelector("[data-root-branch]")?.textContent).toBe("Proposal · yours");
      expect(view.line()?.querySelector("[data-root-branch]")?.getAttribute("data-root-branch")).toBe(BRANCH);
      expect(view.line()?.querySelector("[data-branch-enter]")).toBeFalsy();
      expect(view.overlays).toContain(BRANCH);
      expect(view.record.branch).toBe(BRANCH);
      await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
      await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "keydown", { key: "Enter" });
      await view.waitFor(() => view.root.querySelector("[data-block-editor]") != null);
      const editor = view.root.querySelector("[data-block-editor]") as HTMLElement;
      editor.textContent = "Opening, in the branch.";
      await view.userEvent(editor, "input");
      await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
      await view.userEvent(view.root, "harnessSettle");
      expect(view.commands("revise")[0]?.body["branch"]).toBe(BRANCH);
      await view.userEvent("[data-branch-leave]", "click");
      await view.waitFor(() => view.root.querySelector("[data-root-branch]") == null);
      expect(view.overlays[view.overlays.length - 1]).toBe("");
      expect(view.record.branch).toBeNull();
      expect(view.line()?.querySelector("[data-branch-enter]")).toBeTruthy();
      // The next save after leaving is truth's: no branch on the command,
      // based on the revision truth holds. Found live in the BO_0250
      // walk-through, 2026-09-15.
      await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
      await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "keydown", { key: "Enter" });
      await view.waitFor(() => view.root.querySelector("[data-block-editor]") != null);
      const again = view.root.querySelector("[data-block-editor]") as HTMLElement;
      again.textContent = "Opening, in truth again.";
      await view.userEvent(again, "input");
      await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
      await view.userEvent(view.root, "harnessSettle");
      const saves = view.commands("revise");
      expect(saves).toHaveLength(2);
      expect(saves[1]?.body["branch"]).toBeUndefined();
      expect(saves[1]?.body["baseRevisionId"]).toBe("rev-a");
      await view.settle();
    },
    SAVE_PAUSE_MS + 9000,
  );

  it("Given the tab in its branch with the proposals shown, Then the branch's own items are the document, never proposal blocks", async () => {
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
    const view = await mount(plain, { proposals });
    await view.enter();
    // The panel's toggle, pressed as a reader presses it.
    await view.userEvent('[data-inspector-action="proposed-changes"]', "click");
    await view.waitFor(() => view.root.querySelector("[data-proposal-id]") != null);
    const shown = [...view.root.querySelectorAll("[data-proposal-id]")].map((row) => row.getAttribute("data-proposal-id") ?? "");
    expect(shown.some((id) => id.startsWith("node:run-1"))).toBe(true);
    expect(shown.some((id) => id.startsWith(BRANCH))).toBe(false);
    await view.settle();
  });
});

describe("the acceptance card", () => {
  it("Given no member drifted, Then the card reads the standing and offers Accept, which answers every member and leaves the branch", async () => {
    const view = await mount(plain, {
      proposals: branchProposals(),
      standing: standingOf([
        { ref: "node:blk-a", kind: "node", standing: "clean" },
        { ref: "node:blk-b", kind: "node", standing: "clean" },
        { ref: "node:blk-c", kind: "node", standing: "autoCorrected" },
      ]),
    });
    await view.enter();
    await view.openCard();
    expect(view.card()?.getAttribute("data-branch-card")).toBe("ready");
    expect([...(view.card()?.querySelectorAll("[data-branch-member]") ?? [])].map((member) => member.querySelector("span")?.textContent)).toEqual([
      "unchanged",
      "unchanged",
      "moved beneath it, corrected on acceptance",
    ]);
    expect(view.commands("answerProposal")).toHaveLength(0);
    expect(view.sent.some((command) => command.url.endsWith("/reconcile"))).toBe(false);
    await view.userEvent("[data-branch-establish]", "click");
    await view.waitFor(() => view.root.querySelector("[data-root-branch]") == null);
    expect(view.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"], command.body["edited"]])).toEqual([
      [`${BRANCH}|replace|node:blk-a`, "accepted", undefined],
      [`${BRANCH}|replace|node:blk-b`, "accepted", undefined],
      [`${BRANCH}|insert|node:blk-c`, "accepted", undefined],
    ]);
    expect(view.card()).toBeFalsy();
    await view.settle();
  });

  it("Given drifted members, Then Accept waits until each is kept or dropped, and then keeps one over its drift and rejects the other", async () => {
    const view = await mount(plain, {
      proposals: branchProposals(),
      standing: standingOf([
        { ref: "node:blk-a", kind: "node", standing: "drifted" },
        { ref: "node:blk-b", kind: "node", standing: "drifted" },
        { ref: "node:blk-c", kind: "node", standing: "clean" },
      ]),
    });
    await view.enter();
    await view.openCard();
    expect(view.card()?.getAttribute("data-branch-card")).toBe("open");
    expect(view.card()?.querySelector("[data-branch-establish]")).toBeFalsy();
    expect(view.card()?.querySelector("[data-branch-note]")?.textContent).toContain("Keep your words");
    await view.userEvent('[data-branch-keep="node:blk-a"]', "click");
    await view.waitFor(() => view.card()?.querySelector('[data-branch-member="node:blk-a"]')?.getAttribute("data-member-choice") === "keep");
    expect(view.card()?.querySelector("[data-branch-establish]")).toBeFalsy();
    await view.userEvent('[data-branch-drop="node:blk-b"]', "click");
    await view.waitFor(() => view.card()?.querySelector("[data-branch-establish]") != null);
    await view.userEvent("[data-branch-establish]", "click");
    await view.waitFor(() => view.root.querySelector("[data-root-branch]") == null);
    expect(view.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"], command.body["edited"]])).toEqual([
      [`${BRANCH}|replace|node:blk-a`, "accepted", true],
      [`${BRANCH}|replace|node:blk-b`, "rejected", undefined],
      [`${BRANCH}|insert|node:blk-c`, "accepted", undefined],
    ]);
    await view.settle();
  });

  it("Given a drifted member rewritten in the branch, Then the card reads the standing again and Accept stands; Not yet closes it", async () => {
    let reads = 0;
    const view = await mount(plain, {
      proposals: branchProposals(),
      standing: () =>
        standingOf([{ ref: "node:blk-a", kind: "node", standing: reads++ === 0 ? "drifted" : "clean" }]),
    });
    await view.enter();
    await view.openCard();
    expect(view.card()?.querySelector("[data-branch-establish]")).toBeFalsy();
    await view.userEvent("[data-branch-not-yet]", "click");
    await view.waitFor(() => view.card() == null);
    expect(view.root.querySelector("[data-root-branch]")).toBeTruthy();
    await view.openCard();
    expect(view.card()?.getAttribute("data-branch-card")).toBe("ready");
    await view.settle();
  });

  it("Given a run proposed into the branch, Then its record is not listed on the card and is answered with the branch on Accept and on Reject", async () => {
    const withRun = standingOf([
      { ref: "node:blk-a", kind: "node", standing: "clean" },
      { ref: "node:run:arun-harness", kind: "node", standing: "clean" },
    ]);
    const view = await mount(plain, { proposals: branchProposals(), standing: withRun });
    await view.enter();
    await view.openCard();
    expect([...(view.card()?.querySelectorAll("[data-branch-member]") ?? [])].map((member) => member.getAttribute("data-branch-member"))).toEqual(["node:blk-a"]);
    await view.userEvent("[data-branch-establish]", "click");
    await view.waitFor(() => view.root.querySelector("[data-root-branch]") == null);
    const accepted = view.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"]]);
    expect(accepted[accepted.length - 1]).toEqual([`${BRANCH}|run|node:run:arun-harness`, "accepted"]);
    await view.settle();
    vi.unstubAllGlobals();
    leaveBranch("doc-1");

    const again = await mount(plain, { proposals: branchProposals(), standing: withRun });
    await again.enter();
    await again.userEvent("[data-branch-reject]", "click");
    await again.waitFor(() => again.root.querySelector("[data-root-branch]") == null);
    const rejected = again.commands("answerProposal").map((command) => [command.body["itemId"], command.body["answer"]]);
    expect(rejected[rejected.length - 1]).toEqual([`${BRANCH}|run|node:run:arun-harness`, "rejected"]);
    await again.settle();
  });

  it("Given an answer refused, Then the card names it and stands", async () => {
    const view = await mount(plain, {
      proposals: branchProposals(),
      standing: standingOf([{ ref: "node:blk-a", kind: "node", standing: "clean" }]),
      refuseAnswers: true,
    });
    await view.enter();
    await view.openCard();
    await view.userEvent("[data-branch-establish]", "click");
    await view.waitFor(() => view.card()?.querySelector("[data-branch-refusal]") != null);
    expect(view.root.querySelector("[data-root-branch]")).toBeTruthy();
    await view.settle();
  });
});

describe("a rejected branch", () => {
  it("Given Reject this proposal, Then every member is rejected, the tab leaves the branch, and the rows list what it held with Promote this block on its own", async () => {
    const held: DocumentView = {
      ...plain,
      blocks: [
        plain.blocks[0] as DocumentView["blocks"][number],
        { ...(plain.blocks[1] as DocumentView["blocks"][number]), revisionId: "rev-b2", runs: words("Request-local caching, revised in the branch.") } as DocumentView["blocks"][number],
      ],
    };
    const view = await mount(plain, { proposals: branchProposals(), overlayDocuments: { [BRANCH]: held } });
    await view.enter();
    await view.userEvent("[data-branch-reject]", "click");
    await view.waitFor(() => view.root.querySelector("[data-branch-rejected]") != null);
    expect(view.root.querySelector("[data-root-branch]")).toBeFalsy();
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
 * Separation of duties in the editor (`BO_0212_011`–`_013`): under a policy on
 * documents the document opens in the person's branch, which they neither
 * accept nor leave, and every save stages into it; a save the core refuses
 * because the policy came while the tab was open enters the branch and is
 * made again there; an acceptance refused as the person's own is said in
 * words.
 */
describe("separation of duties", () => {
  it("Given documents under the policy, Then the document opens in the branch, with no Accept and no Leave, and a save names the branch", async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(plain, sent, { branch: { branch: BRANCH, status: "none" }, required: true, proposals: { documentId: "doc-1", unanswered: 0, groups: [] } }));
    const required = await mountEditor(plain);
    const waitFor = async (until: () => boolean) => {
      for (let tick = 0; tick < 300; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await required.userEvent(required.root, "harnessSettle");
        if (until()) return;
      }
      throw new Error("waited, and it did not happen");
    };
    await waitFor(() => required.root.querySelector("[data-root-branch]") != null);
    const line = required.root.querySelector("[data-document-branch]") as HTMLElement;
    expect(line.querySelector("[data-root-branch]")?.getAttribute("data-branch-required")).toBe("true");
    expect(line.querySelector("[data-branch-review]")?.textContent).toBe("Someone else accepts it.");
    expect(line.querySelector("[data-branch-accept]")).toBeFalsy();
    expect(line.querySelector("[data-branch-leave]")).toBeFalsy();
    expect(line.querySelector("[data-branch-reject]")).toBeTruthy();
    expect(line.querySelector("[data-branch-enter]")).toBeFalsy();
    await required.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
    await required.userEvent('[data-block-id="blk-a"] [data-block-reading]', "keydown", { key: "Enter" });
    await waitFor(() => required.root.querySelector("[data-block-editor]") != null);
    const editor = required.root.querySelector("[data-block-editor]") as HTMLElement;
    editor.textContent = "Opening, reviewed.";
    await required.userEvent(editor, "input");
    await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
    await required.userEvent(required.root, "harnessSettle");
    const saves = sent.filter((command) => command.body["command"] === "revise");
    expect(saves).toHaveLength(1);
    expect(saves[0]?.body["branch"]).toBe(BRANCH);
    await required.settle();
  });

  it("Given no policy, Then the document opens in truth with Work in a proposal", async () => {
    const view = await mount();
    await view.waitFor(() => view.line() != null);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await view.userEvent(view.root, "harnessSettle");
    expect(view.line()?.querySelector("[data-branch-enter]")).toBeTruthy();
    expect(view.line()?.querySelector("[data-root-branch]")).toBeFalsy();
    await view.settle();
  });

  it("Given a save refused because the policy came while the tab was open, Then the tab enters the branch and the save is made again into it", async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(plain, sent, { branch: { branch: BRANCH, status: "none" }, refuseTruthSaves: true, proposals: { documentId: "doc-1", unanswered: 0, groups: [] } }));
    const view = await mountEditor(plain);
    const waitFor = async (until: () => boolean) => {
      for (let tick = 0; tick < 300; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await view.userEvent(view.root, "harnessSettle");
        if (until()) return;
      }
      throw new Error("waited, and it did not happen");
    };
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "keydown", { key: "Enter" });
    await waitFor(() => view.root.querySelector("[data-block-editor]") != null);
    const editor = view.root.querySelector("[data-block-editor]") as HTMLElement;
    editor.textContent = "Opening, typed before the policy.";
    await view.userEvent(editor, "input");
    await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
    await waitFor(() => sent.filter((command) => command.body["command"] === "revise").length >= 2);
    const saves = sent.filter((command) => command.body["command"] === "revise");
    expect(saves[0]?.body["branch"]).toBeUndefined();
    expect(saves[1]?.body["branch"]).toBe(BRANCH);
    expect(saves[1]?.body["runs"]).toEqual(saves[0]?.body["runs"]);
    expect(view.root.querySelector("[data-root-branch]")?.getAttribute("data-branch-required")).toBe("true");
    expect(view.root.textContent).toContain("Documents are now reviewed by someone else: your edits go into your proposal.");
    // The block still active took the retried save as its own: leaving it
    // writes nothing more.
    await view.userEvent("[data-block-done]", "click");
    await waitFor(() => view.root.querySelector("[data-block-editor]") == null);
    expect(sent.filter((command) => command.body["command"] === "revise")).toHaveLength(2);
    await view.settle();
  });

  it("Given the refused save was the one made on leaving the block, Then what was typed is still saved into the branch", async () => {
    // Found live in the BO_0212_013 walk: a press outside the block saved it
    // and let it go, so the retry found no active block and the text was lost.
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(plain, sent, { branch: { branch: BRANCH, status: "none" }, refuseTruthSaves: true, proposals: { documentId: "doc-1", unanswered: 0, groups: [] } }));
    const view = await mountEditor(plain);
    const waitFor = async (until: () => boolean) => {
      for (let tick = 0; tick < 300; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await view.userEvent(view.root, "harnessSettle");
        if (until()) return;
      }
      throw new Error("waited, and it did not happen");
    };
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "keydown", { key: "Enter" });
    await waitFor(() => view.root.querySelector("[data-block-editor]") != null);
    const editor = view.root.querySelector("[data-block-editor]") as HTMLElement;
    editor.textContent = "Opening, typed before the policy.";
    await view.userEvent(editor, "input");
    await view.userEvent("[data-block-done]", "click");
    await waitFor(() => sent.filter((command) => command.body["command"] === "revise").length >= 2);
    const saves = sent.filter((command) => command.body["command"] === "revise");
    expect(saves[0]?.body["branch"]).toBeUndefined();
    expect(saves[1]?.body["branch"]).toBe(BRANCH);
    expect(saves[1]?.body["runs"]).toEqual(saves[0]?.body["runs"]);
    expect(saves[1]?.body["baseRevisionId"]).toBe(saves[0]?.body["baseRevisionId"]);
    expect(view.root.querySelector("[data-root-branch]")?.getAttribute("data-branch-required")).toBe("true");
    await view.settle();
  });
});
