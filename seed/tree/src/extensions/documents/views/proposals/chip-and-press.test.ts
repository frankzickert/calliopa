import { afterEach, describe, expect, it, vi } from "vitest";

import { HOVER_DEPTH_MS } from "../block-editor";
import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * A proposal's chip and the press on a desktop and a phone, pressed in Qwik's
 * render harness (DO_0004_006): the face, the words and the answers in one
 * chip; a proposal's text taking the caret at once on a pointer that hovers
 * and after a first tap elsewhere; one click editing an ordinary block on a
 * desktop, two on a phone; hovering revealing a row's depth; and an accepted
 * rewrite landing where the reader moved it. What the chip looks like —
 * hidden at rest, 24px controls, the spacing — is CSS, measured in Chromium.
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

const proposalsWith = (order: string): DocumentProposals => ({
  documentId: "doc-1",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" },
      items: [
        {
          itemId: rewrite,
          groupId: "node:run-claude",
          kind: "replace",
          blockId: "blk-b",
          block: { kind: "text", blockId: "blk-b", revisionId: "rev-b2", containmentId: "c-b", order, role: "paragraph", standing: "keep", runs: [{ text: "The storm arrives early." }] },
        },
      ],
    },
  ],
});

/** A page read with a pointer that hovers, or not. */
const pointer = (hovers: boolean) =>
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: hovers, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (options: { proposalOrder?: string; showProposals?: boolean } = {}) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals: proposalsWith(options.proposalOrder ?? "b") }));
  const view = await mountEditor(draft);
  if (options.showProposals !== false) {
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
  }
  const proposal = () => view.root.querySelector(`[data-proposal-id="${rewrite}"]`) as HTMLElement | null;
  const rows = () =>
    Array.from(view.root.querySelectorAll("[data-block-id], [data-proposal-id]"))
      .filter((row) => row.closest("[data-proposal-id]") === row || row.getAttribute("data-proposal-id") === null)
      .map((row) => row.getAttribute("data-proposal-id") ?? row.getAttribute("data-block-id"));
  const commands = () => sent.map((command) => String(command.body["command"]));
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, sent, proposal, rows, commands, waitFor };
};

describe("the proposal chip and the press", () => {
  it("Given a proposal, Then its face, its words and its answers stand in one chip, in that order", async () => {
    const view = await mount();
    const chip = view.proposal()?.querySelector("[data-proposal-mark]") as HTMLElement;
    expect(chip.className).toBe("proposal-block__mark");
    expect(Array.from(chip.children).map((child) => child.className)).toEqual([
      "proposal-block__face",
      "proposal-block__words",
      "proposal-block__answers",
    ]);
    expect(chip.querySelector("[data-proposal-accept]")).not.toBeNull();
    expect(chip.querySelector("[data-proposal-reject]")).not.toBeNull();
    // The face's portrait fits the chip's 24px, as the command chip's does.
    expect(chip.querySelector("img")?.getAttribute("width")).toBe("18");
    await view.settle();
  });

  it("Given a pointer that hovers, Then a proposal's text takes the caret at once", async () => {
    pointer(true);
    const view = await mount();
    const text = view.proposal()?.querySelector("[data-proposal-text]");
    await view.settle(() => text?.getAttribute("contenteditable") === "true");
    expect(text?.getAttribute("contenteditable")).toBe("true");
    await view.settle();
  });

  it("Given a phone, When a proposal is tapped, Then it is focused first and its text takes the caret only then, and leaving it takes that back", async () => {
    pointer(false);
    const view = await mount();
    const text = view.proposal()?.querySelector("[data-proposal-text]");
    expect(text?.getAttribute("contenteditable")).toBe("false");
    await view.userEvent(`[data-proposal-id="${rewrite}"]`, "focusin");
    await view.settle(() => text?.getAttribute("contenteditable") === "true");
    expect(view.proposal()?.getAttribute("data-engaged")).toBe("true");
    await view.userEvent(`[data-proposal-id="${rewrite}"]`, "focusout", { relatedTarget: null });
    await view.settle(() => text?.getAttribute("contenteditable") === "false");
    expect(view.proposal()?.getAttribute("data-engaged")).toBeNull();
    await view.settle();
  });

  it("Given a pointer that hovers, When an ordinary block is clicked once, Then it is edited", async () => {
    pointer(true);
    const view = await mount({ showProposals: false });
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "pointerdown");
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "click");
    await view.settle(() => view.root.querySelector('[data-block-command="blk-a"]') != null);
    expect(view.root.querySelector('[data-block-command="blk-a"]')).not.toBeNull();
    await view.settle();
  });

  it("Given a phone, When an ordinary block is tapped once, Then it is focused and not edited, and a second tap edits it", async () => {
    pointer(false);
    const view = await mount({ showProposals: false });
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "pointerdown");
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "click");
    await view.settle(() => view.root.querySelector('[data-block-id="blk-a"]')?.getAttribute("data-focused") === "true");
    expect(view.root.querySelector('[data-block-command="blk-a"]')).toBeFalsy();
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "pointerdown");
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "click");
    await view.settle(() => view.root.querySelector('[data-block-command="blk-a"]') != null);
    expect(view.root.querySelector('[data-block-command="blk-a"]')).not.toBeNull();
    await view.settle();
  });

  it("Given a pointer that hovers, When it rests on a block and then leaves, Then the block is focused and holds it", async () => {
    pointer(true);
    const view = await mount({ showProposals: false });
    const row = () => view.root.querySelector('[data-block-id="blk-c"]');
    await view.userEvent('[data-block-id="blk-c"]', "pointerenter", { pointerType: "mouse" });
    await view.waitFor(() => row()?.getAttribute("data-focused") === "true");
    expect(HOVER_DEPTH_MS).toBeGreaterThan(0);
    // The focus holds once given: a bar whose block groups emptied behind the
    // pointer would name no block. It goes when another row takes it, when a
    // block is edited, or on a press outside the document. DO_0006_003
    await view.userEvent('[data-block-id="blk-c"]', "pointerleave", { pointerType: "mouse" });
    await view.settle();
    expect(row()?.getAttribute("data-focused")).toBe("true");
    await view.userEvent('[data-block-id="blk-a"]', "pointerenter", { pointerType: "mouse" });
    await view.waitFor(() => view.root.querySelector('[data-block-id="blk-a"]')?.getAttribute("data-focused") === "true");
    expect(row()?.getAttribute("data-focused")).toBeNull();
    await view.settle();
  });

  it("Given a pointer resting on a proposal, Then it is focused like a block and holds it", async () => {
    pointer(true);
    const view = await mount();
    const retire = () =>
      view.root.querySelector('[data-bar-action="block-retire"]')?.getAttribute("aria-label") ?? null;
    await view.userEvent(`[data-proposal-id="${rewrite}"]`, "pointerenter", { pointerType: "mouse" });
    // A proposal is a row like any other under the pointer: after the same
    // rest the bar's block groups act on it. DO_0006_008
    await new Promise((resolve) => setTimeout(resolve, 600));
    await view.settle();
    expect(retire()).toBe("Retire the proposed block");
    // It is drawn as the row the bar acts on, and keeps its chip when the
    // pointer leaves, since the focus holds. DO_0006_010
    expect(view.proposal()?.getAttribute("data-focused")).toBe("true");
    await view.userEvent(`[data-proposal-id="${rewrite}"]`, "pointerleave", { pointerType: "mouse" });
    await view.settle();
    expect(retire()).toBe("Retire the proposed block");
    expect(view.proposal()?.getAttribute("data-focused")).toBe("true");
    await view.settle();
  });

  it("Given several proposals, Then only the one the reader turned to is drawn as focused", async () => {
    pointer(true);
    const view = await mount();
    await view.userEvent(`[data-proposal-id="${rewrite}"]`, "pointerenter", { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await view.settle();
    const drawn = () =>
      Array.from(view.root.querySelectorAll("[data-proposal-id]"))
        .filter((row) => row.getAttribute("data-focused") === "true")
        .map((row) => row.getAttribute("data-proposal-id"));
    expect(drawn()).toEqual([rewrite]);
    // A block taking the focus takes the ring with it.
    await view.userEvent('[data-block-id="blk-c"]', "pointerenter", { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await view.settle();
    expect(drawn()).toEqual([]);
    expect(view.root.querySelector('[data-block-id="blk-c"]')?.getAttribute("data-focused")).toBe("true");
    await view.settle();
  });

  it("Given a proposal's text holding the caret, When the pointer rests on another block, Then nothing is taken from under the reader's hands", async () => {
    pointer(true);
    const view = await mount();
    await view.userEvent(`[data-proposal-text="${rewrite}"]`, "focus");
    await view.waitFor(() => view.root.querySelector('[data-bar-action="block-retire"]')?.getAttribute("aria-label") === "Retire the proposed block");
    // The rest on another row passes; the bar keeps naming the proposal, and
    // the other row takes no ring. DO_0006_008
    await view.userEvent('[data-block-id="blk-c"]', "pointerenter", { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await view.settle();
    expect(view.root.querySelector('[data-bar-action="block-retire"]')?.getAttribute("aria-label")).toBe(
      "Retire the proposed block",
    );
    expect(view.root.querySelector('[data-block-id="blk-c"]')?.getAttribute("data-focused")).toBeNull();
    await view.settle();
  });

  it("Given a rewrite the reader moved, Then it stands where its staged key puts it and its block's row is not drawn", async () => {
    const view = await mount({ proposalOrder: "d" });
    expect(view.rows()).toEqual(["blk-a", "blk-c", rewrite]);
    await view.settle();
  });

  it("Given a rewrite stepped down by its arrow, When it is accepted before the step is staged, Then it is drawn where it went and its place is staged before the answer", async () => {
    const view = await mount();
    expect(view.rows()).toEqual(["blk-a", rewrite, "blk-c"]);
    await view.userEvent(`[data-proposal-id="${rewrite}"] [data-row-down]`, "click");
    await view.settle(() => view.rows().indexOf(rewrite) === 2);
    expect(view.rows()).toEqual(["blk-a", "blk-c", rewrite]);
    // At once, well inside the pause the step waits for.
    await view.userEvent(`[data-proposal-accept="${rewrite}"]`, "click");
    await view.waitFor(() => view.commands().includes("answerProposal"));
    const commands = view.commands();
    expect(commands.indexOf("placeProposal")).toBeGreaterThanOrEqual(0);
    expect(commands.indexOf("placeProposal")).toBeLessThan(commands.indexOf("answerProposal"));
    // Staged once: the timer the step set does not stage it again.
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(view.commands().filter((command) => command === "placeProposal").length).toBe(1);
    await view.settle();
  });
});
