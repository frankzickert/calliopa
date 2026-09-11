import { afterEach, describe, expect, it, vi } from "vitest";

import { PROPOSAL_PAUSE_MS } from "~/lib/proposals";
import type { DocumentView } from "~/server/documents/assemble";
import type { DocumentProposals } from "~/server/documents/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * Proposed changes in the block editor, pressed in Qwik's render harness
 * through the editor's own JSX, with the proposals arriving after it is drawn
 * (`qwik-member-props-freeze`). Each proposal says who proposed it by face,
 * colour and name; is answered by its icons; is accepted by an edit; and
 * moves by its face without being answered. BO_0233_009
 *
 * An edit accepts once the typing pauses or the reader leaves the text, so
 * the proposal never turns into the block under a typing hand. BO_0233_014
 */
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "neutral", runs: [{ text: "Opening." }] },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "neutral", runs: [{ text: "The storm arrives." }] },
    { kind: "text", blockId: "blk-c", revisionId: "rev-c", containmentId: "c-c", order: "c", role: "paragraph", standing: "neutral", runs: [{ text: "Closing." }] },
  ],
};

const rewrite = "node:run-claude|replace|node:blk-b";
const newBlock = "node:run-claude|insert|node:blk-new";
const removal = "node:chg-person|remove|node:blk-c|c-c";
const move = "node:run-codex|move|node:blk-a";

const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 4,
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
          block: { kind: "text", blockId: "blk-b", revisionId: "rev-b2", containmentId: "c-b", order: "b", role: "h1", standing: "neutral", runs: [{ text: "The storm arrives early." }] },
        },
        {
          itemId: newBlock,
          groupId: "node:run-claude",
          kind: "insert",
          blockId: "blk-new",
          block: { kind: "text", blockId: "blk-new", revisionId: "rev-n", containmentId: "", order: "bb", role: "paragraph", standing: "neutral", runs: [{ text: "A new line." }] },
        },
      ],
    },
    {
      groupId: "node:chg-person",
      stagedBy: ["frankzickert"],
      proposer: { kind: "person", name: "frankzickert" },
      items: [{ itemId: removal, groupId: "node:chg-person", kind: "remove", blockId: "blk-c", block: null }],
    },
    {
      groupId: "node:run-codex",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "codex", executedBy: "codex" },
      items: [
        {
          itemId: move,
          groupId: "node:run-codex",
          kind: "move",
          blockId: "blk-a",
          block: { kind: "text", blockId: "blk-a", revisionId: "rev-a2", containmentId: "c-a", order: "bc", role: "paragraph", standing: "neutral", runs: [{ text: "Opening." }] },
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (
  options: { refuseAnswers?: boolean; answerDelayMs?: number; proposalsDelayMs?: () => number } = {},
) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals, ...options }));
  const view = await mountEditor(draft);
  // The panel's toggle, pressed as a reader presses it.
  await view.userEvent('[data-inspector-action="proposed-changes"]', "click");
  await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
  const proposal = (itemId: string) =>
    view.root.querySelector(`[data-proposal-id="${itemId}"]`) as HTMLElement | null;
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name);
  // An edit waits for the typing to pause, the save after it too, and a
  // moved proposal for the presses to, so this waits in real time as well as
  // settling renders.
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  const pause = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await view.userEvent(view.root, "harnessSettle");
  };
  /** The block the editor has active, when it has one. */
  const active = () => view.root.querySelector("[data-block-editor]") as HTMLElement | null | undefined;
  return { ...view, sent, proposal, commands, waitFor, pause, active };
};

describe("proposed changes in the block editor", () => {
  it("Given proposals from Claude Code, a person and Codex, Then each says who by face, colour and name, with no label line", async () => {
    const view = await mount();
    const claude = view.proposal(rewrite);
    expect(claude?.getAttribute("data-proposal-tone")).toBe("claude");
    expect(claude?.getAttribute("aria-label")).toBe("Proposed rewrite by Claude Code (claude-sonnet-5)");
    const face = claude?.querySelector("[data-proposal-face]");
    expect(face?.getAttribute("aria-label")).toContain("Proposed by Claude Code (claude-sonnet-5)");
    expect(face?.querySelector("img")?.getAttribute("src")).toBe("/agents/clauderic.webp");
    expect(face?.querySelector("img")?.getAttribute("alt")).toBe("");

    expect(view.proposal(removal)?.getAttribute("data-proposal-tone")).toBe("person");
    expect(view.proposal(removal)?.querySelector('[data-icon="user"]')).not.toBeNull();
    expect(view.proposal(move)?.getAttribute("data-proposal-tone")).toBe("codex");

    const words = view.root.textContent ?? "";
    expect(words).not.toContain("Proposed rewrite");
    expect(words).not.toContain("staged by");
    await view.settle();
  });

  it("Given a proposal, Then its answers are icons named in words, and accept-all only for a group of more than one", async () => {
    const view = await mount();
    const claude = view.proposal(rewrite);
    expect(claude?.querySelector("[data-proposal-accept]")?.getAttribute("aria-label")).toBe("Accept Claude Code's rewrite");
    expect(claude?.querySelector("[data-proposal-accept] [data-icon='check']")).not.toBeNull();
    expect(claude?.querySelector("[data-proposal-reject]")?.getAttribute("aria-label")).toBe("Reject Claude Code's rewrite");
    expect(claude?.querySelector("[data-proposal-reject] [data-icon='x']")).not.toBeNull();
    expect(claude?.querySelector("[data-proposal-accept-all] [data-icon='checks']")).not.toBeNull();
    expect(view.proposal(removal)?.querySelector("[data-proposal-accept-all]")).toBeFalsy();
    await view.settle();
  });

  it("Given a rewrite, Then it is drawn in its role's element after the block it rewrites, and editable", async () => {
    const view = await mount();
    const text = view.proposal(rewrite)?.querySelector("[data-proposal-text]");
    // A heading proposed for a paragraph is drawn as the heading it would be.
    expect(text?.tagName.toLowerCase()).toBe("h3");
    expect(text?.getAttribute("contenteditable")).toBe("true");
    const rows = Array.from(view.root.querySelectorAll("[data-block-id], [data-proposal-id]")).map(
      (row) => row.getAttribute("data-proposal-id") ?? row.getAttribute("data-block-id"),
    );
    expect(rows.indexOf(rewrite)).toBe(rows.indexOf("blk-b") + 1);
    await view.settle();
  });

  it("Given a removal and a move, Then each frames the block that stands, and the move says where it would go", async () => {
    const view = await mount();
    const removing = view.proposal(removal);
    expect(removing?.querySelector('[data-block-id="blk-c"]')).not.toBeNull();
    expect(removing?.querySelector("[data-proposal-text]")).toBeFalsy();
    expect(removing?.querySelector("[data-proposal-face]")?.getAttribute("aria-label")).toBe("Proposed by frankzickert");
    const moving = view.proposal(move);
    expect(moving?.querySelector('[data-block-id="blk-a"]')).not.toBeNull();
    expect(moving?.querySelector("[data-proposal-moves]")).not.toBeNull();
    expect(moving?.getAttribute("aria-label")).toBe("Proposed move by Codex, would move before “Closing.”");
    await view.settle();
  });

  it("Given a first input to a proposal's text, Then the item is accepted and the edit made on the block after", { timeout: 10000 }, async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-text="${rewrite}"]`, "beforeinput", { inputType: "insertText", data: "!" });
    await view.waitFor(() => view.commands("revise").length > 0);

    // An edit's acceptance, which takes a rewrite over what its block did
    // since. CA_0042_003
    expect(view.commands("answerProposal").map((command) => command.body)).toEqual([
      { command: "answerProposal", itemId: rewrite, answer: "accepted", edited: true },
    ]);
    const revise = view.commands("revise")[0]?.body;
    expect(revise?.["blockId"]).toBe("blk-b");
    expect(JSON.stringify(revise?.["runs"])).toContain("!The storm arrives early.");
    const order = view.sent.map((command) => command.body["command"]);
    expect(order.indexOf("answerProposal")).toBeLessThan(order.indexOf("revise"));
    await view.settle();
  });

  it("Given typing that goes on, Then the proposal keeps its look and nothing is accepted until it pauses, and then the block takes the caret", { timeout: 10000 }, async () => {
    const view = await mount();
    const text = `[data-proposal-text="${rewrite}"]`;
    for (const key of ["a", "b", "c"]) {
      await view.userEvent(text, "beforeinput", { inputType: "insertText", data: key });
      // Shorter than the pause: the typing goes on.
      await view.pause(PROPOSAL_PAUSE_MS / 2);
      expect(view.commands("answerProposal")).toEqual([]);
      expect(view.proposal(rewrite)?.getAttribute("data-proposal-tone")).toBe("claude");
      expect(view.active()).toBeFalsy();
    }
    expect(view.root.querySelector(text)?.textContent).toBe("abcThe storm arrives early.");

    await view.waitFor(() => Boolean(view.active()));
    expect(view.commands("answerProposal")).toHaveLength(1);
    expect(view.proposal(rewrite)).toBeFalsy();
    // The block holds what was typed, where the proposal stood, with the caret.
    expect(view.active()?.closest("[data-block-id]")?.getAttribute("data-block-id")).toBe("blk-b");
    expect(view.active()?.textContent).toBe("abcThe storm arrives early.");
    await view.waitFor(() => view.commands("revise").length > 0);
    expect(JSON.stringify(view.commands("revise")[0]?.body["runs"])).toContain("abcThe storm arrives early.");
    await view.settle();
  });

  it("Given keystrokes while the acceptance is under way, Then the block takes them too", { timeout: 10000 }, async () => {
    const view = await mount({ answerDelayMs: 400 });
    const text = `[data-proposal-text="${rewrite}"]`;
    await view.userEvent(text, "beforeinput", { inputType: "insertText", data: "a" });
    // The pause has passed and the acceptance is asked for.
    await view.waitFor(() => view.commands("answerProposal").length > 0);
    await view.userEvent(text, "beforeinput", { inputType: "insertText", data: "b" });
    expect(view.root.querySelector(text)?.textContent).toBe("abThe storm arrives early.");
    await view.waitFor(() => view.commands("revise").length > 0);
    expect(JSON.stringify(view.commands("revise")[0]?.body["runs"])).toContain("abThe storm arrives early.");
    await view.settle();
  });

  it("Given a reader who leaves a proposal they typed into, Then it is accepted and the typing written at once, and the caret stays where they took it", { timeout: 10000 }, async () => {
    const view = await mount();
    const text = `[data-proposal-text="${rewrite}"]`;
    await view.userEvent(text, "focus");
    await view.userEvent(text, "beforeinput", { inputType: "insertText", data: "x" });
    const left = Date.now();
    await view.userEvent(text, "blur");
    await view.waitFor(() => view.commands("revise").length > 0);
    expect(Date.now() - left).toBeLessThan(PROPOSAL_PAUSE_MS);
    expect(view.commands("answerProposal")).toHaveLength(1);
    const revise = view.commands("revise")[0]?.body;
    expect(revise?.["blockId"]).toBe("blk-b");
    expect(revise?.["baseRevisionId"]).toMatch(/^rev-next-/);
    expect(JSON.stringify(revise?.["runs"])).toContain("xThe storm arrives early.");
    expect(view.proposal(rewrite)).toBeFalsy();
    expect(view.active()).toBeFalsy();
    await view.settle();
  });

  it("Given typing, then the accept icon before the pause, Then it is accepted once and the typing still reaches the block", { timeout: 10000 }, async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-text="${rewrite}"]`, "beforeinput", { inputType: "insertText", data: "x" });
    await view.userEvent(`[data-proposal-accept="${rewrite}"]`, "click");
    await view.waitFor(() => view.commands("revise").length > 0);
    expect(view.commands("answerProposal").map((command) => command.body["answer"])).toEqual(["accepted"]);
    expect(JSON.stringify(view.commands("revise")[0]?.body["runs"])).toContain("xThe storm arrives early.");
    await view.settle();
  });

  it("Given the accept icons, Then they answer as the icons, never as an edit", { timeout: 10000 }, async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-accept="${move}"]`, "click");
    await view.waitFor(() => view.commands("answerProposal").length > 0);
    await view.userEvent(`[data-proposal-accept-all="node:run-claude"]`, "click");
    await view.waitFor(() => view.commands("answerProposal").length > 2);
    // Without an edit's say, a rewrite whose block moved since is still
    // refused. CA_0042_003
    expect(view.commands("answerProposal").map((command) => command.body)).toEqual([
      { command: "answerProposal", itemId: move, answer: "accepted" },
      { command: "answerProposal", itemId: rewrite, answer: "accepted" },
      { command: "answerProposal", itemId: newBlock, answer: "accepted" },
    ]);
    await view.settle();
  });

  it("Given typing, then the reject icon before the pause, Then it is rejected and nothing typed is accepted after", { timeout: 10000 }, async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-text="${rewrite}"]`, "beforeinput", { inputType: "insertText", data: "x" });
    await view.userEvent(`[data-proposal-reject="${rewrite}"]`, "click");
    await view.pause(PROPOSAL_PAUSE_MS + 300);
    expect(view.commands("answerProposal").map((command) => command.body["answer"])).toEqual(["rejected"]);
    expect(view.commands("revise")).toEqual([]);
    expect(view.root.textContent).not.toContain("was not accepted");
    await view.settle();
  });

  it("Given a new paragraph in a proposal, Then the block takes it over at once, for the reader to repeat there", async () => {
    const view = await mount();
    const pressed = Date.now();
    await view.userEvent(`[data-proposal-text="${rewrite}"]`, "beforeinput", { inputType: "insertParagraph" });
    await view.waitFor(() => Boolean(view.active()));
    expect(Date.now() - pressed).toBeLessThan(PROPOSAL_PAUSE_MS);
    expect(view.commands("answerProposal")).toHaveLength(1);
    await view.settle();
  });

  it("Given a composition, Then the browser writes it, and its end is typing like any other", { timeout: 10000 }, async () => {
    const view = await mount();
    const text = `[data-proposal-text="${rewrite}"]`;
    await view.userEvent(text, "beforeinput", { inputType: "insertCompositionText", data: "ü", isComposing: true });
    await view.pause(10);
    // Not the proposal's to paint while the composition is open.
    expect(view.root.querySelector(text)?.textContent).toBe("The storm arrives early.");
    // What the browser wrote, as a keyboard's composition writes it.
    const element = view.root.querySelector(text) as HTMLElement;
    element.textContent = "üThe storm arrives early.";
    await view.userEvent(text, "compositionend");
    expect(view.commands("answerProposal")).toEqual([]);
    await view.waitFor(() => view.commands("revise").length > 0);
    expect(JSON.stringify(view.commands("revise")[0]?.body["runs"])).toContain("üThe storm arrives early.");
    await view.settle();
  });

  it("Given a slow read of the proposals begun before an edit accepts one, Then it does not draw the accepted one again", { timeout: 10000 }, async () => {
    let delay = 0;
    const view = await mount({ proposalsDelayMs: () => delay });
    // A read begins that will answer, 600 ms on, with the list as it stands
    // now — the rewrite still unanswered. Every read after it is quick, so it
    // lands last: the harness's flush waits for the editor's own reads, and a
    // slow one would have corrected the list before anything could be seen.
    delay = 600;
    await view.userEvent('[data-inspector-action="proposed-changes"]', "click");
    const reading = view.userEvent('[data-inspector-action="proposed-changes"]', "click");
    await new Promise((resolve) => setTimeout(resolve, 20));
    delay = 0;
    // Typed into, and left: accepted, without the block taking the caret.
    const text = `[data-proposal-text="${rewrite}"]`;
    await view.userEvent(text, "focus");
    await view.userEvent(text, "beforeinput", { inputType: "insertText", data: "a" });
    await view.userEvent(text, "blur");
    expect(view.commands("answerProposal")).toHaveLength(1);
    // After the stale read has landed.
    await view.pause(900);
    expect(view.proposal(rewrite)).toBeFalsy();
    // A keystroke meant for the block cannot reach a copy that is not drawn,
    // and the rewrite was accepted once.
    const revived = view.root.querySelector(text);
    if (revived) {
      await view.userEvent(revived, "beforeinput", { inputType: "insertText", data: "b" });
      await view.userEvent(revived, "blur");
    }
    expect(view.commands("answerProposal")).toHaveLength(1);
    await reading;
    await view.settle();
  });

  it("Given a refused acceptance after typing, Then the proposal's own words come back", { timeout: 10000 }, async () => {
    const view = await mount({ refuseAnswers: true, answerDelayMs: 50 });
    const text = `[data-proposal-text="${rewrite}"]`;
    const typing = view.userEvent(text, "beforeinput", { inputType: "insertText", data: "x" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await view.userEvent(view.root, "harnessSettle");
    expect(view.root.querySelector(text)?.textContent).toBe("xThe storm arrives early.");
    await typing;
    await view.waitFor(() => (view.root.textContent ?? "").includes("was not accepted"));
    await view.settle();
    expect(view.root.querySelector(text)?.textContent).toBe("The storm arrives early.");
    expect(view.commands("revise")).toEqual([]);
  });

  it("Given an input that changes nothing, Then nothing is accepted", async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-text="${rewrite}"]`, "beforeinput", { inputType: "historyUndo" });
    await view.settle();
    expect(view.commands("answerProposal")).toEqual([]);
  });

  it("Given an acceptance the kernel refuses, Then the edit is not made, the proposal stands and the notice says why", { timeout: 10000 }, async () => {
    const view = await mount({ refuseAnswers: true });
    await view.userEvent(`[data-proposal-text="${rewrite}"]`, "beforeinput", { inputType: "insertText", data: "!" });
    await view.waitFor(() => (view.root.textContent ?? "").includes("was not accepted"));
    expect(view.commands("revise")).toEqual([]);
    expect(view.proposal(rewrite)).not.toBeNull();
    expect(view.root.textContent).toContain("confirmation");
    await view.settle();
  });

  it("Given a long press on a proposal on touch, Then its drag starts, it lifts, and the page stops scrolling under it", async () => {
    const view = await mount();
    const block = view.proposal(newBlock) as HTMLElement;
    // Native events at the block, whose native listeners hear the long
    // press; they do not bubble on to the editor's page listeners, which
    // reach a global `Element` this DOM does not have.
    const text = block;
    const fire = (target: HTMLElement, type: string, init: Record<string, unknown>) => {
      const event = block.ownerDocument.createEvent("Event");
      event.initEvent(type, false, true);
      Object.assign(event, init);
      target.dispatchEvent(event);
      return event;
    };
    fire(text, "pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 });
    await view.settle();
    expect(view.record.drags).toEqual([`proposal:${newBlock}`]);
    expect(fire(text, "touchmove", {}).defaultPrevented).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(block.getAttribute("data-lifted")).toBe("true");
    expect(fire(text, "touchmove", {}).defaultPrevented).toBe(true);
    fire(text, "pointerup", { pointerType: "touch" });
    expect(block.hasAttribute("data-lifted")).toBe(false);

    // A press that moves first is a scroll: nothing lifts.
    fire(text, "pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 });
    fire(text, "pointermove", { pointerType: "touch", clientX: 10, clientY: 40 });
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(block.hasAttribute("data-lifted")).toBe(false);
    fire(text, "pointerup", { pointerType: "touch" });

    // A mouse selects text by pressing and dragging; its handle is the face.
    const drags = view.record.drags.length;
    fire(text, "pointerdown", { pointerType: "mouse", clientX: 10, clientY: 10 });
    await view.settle();
    expect(view.record.drags).toHaveLength(drags);
    await view.settle();
  });

  it("Given the arrow keys on a new block's face, Then it moves and its place is staged once, unanswered", async () => {
    const view = await mount();
    const face = `[data-proposal-face="${newBlock}"]`;
    await view.userEvent(face, "keydown", { key: "ArrowDown" });
    await view.userEvent(face, "keydown", { key: "ArrowDown" });
    // Drawn in its new place at once: after the closing block, at the end.
    const rows = Array.from(view.root.querySelectorAll("[data-block-id], [data-proposal-id]"))
      .map((row) => row.getAttribute("data-proposal-id") ?? row.getAttribute("data-block-id"))
      .filter((id) => id !== null && !id.includes("|remove|") && !id.includes("|move|"));
    expect(rows.indexOf(newBlock)).toBeGreaterThan(rows.indexOf("blk-c"));
    await view.waitFor(() => view.commands("placeProposal").length > 0);
    // And only once, however long it is left.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await view.settle();
    expect(view.commands("placeProposal").map((command) => command.body)).toEqual([
      { command: "placeProposal", itemId: newBlock, placement: { at: "end" } },
    ]);
    expect(view.commands("answerProposal")).toEqual([]);
  });
});
