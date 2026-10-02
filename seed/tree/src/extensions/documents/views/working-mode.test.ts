import { afterEach, describe, expect, it, vi } from "vitest";

import { proposerOf } from "../lib/proposals";
import type { DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * The working mode on a block's command line and on a proposal's chip,
 * pressed in Qwik's render harness (`BO_0306`, `DO_0025`): the bar draws no
 * mode; a block's line starts from the mode last sent in the document; a send
 * carries the block's mode, writes it as the document's last and tells the
 * shell, which hands it to the console and gestures; a refused write leaves
 * the run sent and says so; and a proposal's chip names the mode its run
 * served and where the run strayed from it. BO_0306_013 BO_0306_015
 * DO_0025_006 DO_0025_009
 */
const draft: DocumentView = {
  documentId: "doc-mode",
  revisionId: "rev-doc",
  title: "Mode",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening." }] },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "Closing." }] },
  ],
};

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

type Mode = { field: string; work: string };

const mount = async (options: { mode?: Mode; modeRefused?: boolean; proposals?: DocumentProposals } = {}) => {
  const sent: SentCommand[] = [];
  const modes: Mode[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { ...options, modes }));
  const view = await mountEditor(draft);
  last = view;
  return { ...view, modes };
};

const control = (root: HTMLElement, id: string) => (root.querySelector(`[data-bar-action="${id}"]`) as HTMLElement | null) ?? null;

describe("the working mode on the command line (DO_0025)", () => {
  it("Given a document never sent from, Then the bar draws no mode, a block's line starts at explore and create, and the shell is told", async () => {
    const view = await mount();
    const work = view.root.querySelector('[data-bar-group="work"]');
    expect(Array.from(work?.querySelectorAll("[data-bar-action]") ?? []).map((action) => action.getAttribute("data-bar-action"))).not.toContain("working-mode-field");
    expect(control(view.root, "working-mode-work")).toBeNull();
    expect(view.record.mode).toEqual({ field: "explore", work: "create" });
    await activateBlock(view, "blk-a");
    const field = view.root.querySelector('[data-block-command="blk-a"] [data-block-mode="field"]');
    expect(field?.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe("arrows-out-simple");
    expect(field?.getAttribute("aria-label")).toBe("Exploring — switch to consolidate");
  });

  it("Given a mode last sent in the document, Then a block never sent starts from it, and the console and gestures carry it", async () => {
    const view = await mount({ mode: { field: "consolidate", work: "understand" } });
    expect(view.record.mode).toEqual({ field: "consolidate", work: "understand" });
    await activateBlock(view, "blk-b");
    const poles = Array.from(view.root.querySelectorAll('[data-block-command="blk-b"] [data-block-mode]')).map((toggle) => toggle.getAttribute("data-block-mode-pole"));
    expect(poles).toEqual(["consolidate", "understand"]);
  });

  it("Given a switch on a block and a send, Then nothing is written until the send, which writes the mode as the document's last and tells the shell", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    await view.userEvent('[data-block-command="blk-a"] [data-block-mode="work"]', "click");
    await view.settle(() => view.root.querySelector('[data-block-command="blk-a"] [data-block-mode="work"]')?.getAttribute("data-block-mode-pole") === "understand");
    expect(view.modes).toEqual([]);
    await view.userEvent('[data-block-command="blk-a"] [data-block-send]', "click");
    await view.settle(() => view.modes.length === 1);
    expect(view.modes).toEqual([{ field: "explore", work: "understand" }]);
    expect(view.record.mode).toEqual({ field: "explore", work: "understand" });
  });

  it("Given the kernel refuses to keep the mode, Then the run is still sent, and the control's note says the mode was not kept", async () => {
    const view = await mount({ modeRefused: true });
    await activateBlock(view, "blk-a");
    await view.userEvent('[data-block-command="blk-a"] [data-block-keep]', "click");
    await view.userEvent('[data-block-command="blk-a"] [data-block-send]', "click");
    await view.settle(() => view.root.querySelector("[data-block-send-refusal]") != null);
    expect((view.record.commands ?? []).length).toBe(1);
    expect(view.root.querySelector("[data-block-send-refusal]")?.textContent).toContain("could not be kept as the document's last");
  });
});

const rewrite = "node:run-a|replace|node:blk-a";
const proposed = (proposer: DocumentProposals["groups"][number]["proposer"]): DocumentProposals => ({
  documentId: "doc-mode",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-a",
      stagedBy: ["agent:hermes"],
      proposer,
      items: [
        {
          itemId: rewrite,
          groupId: "node:run-a",
          kind: "replace",
          blockId: "blk-a",
          block: { kind: "text", blockId: "blk-a", revisionId: "rev-a2", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening, reworked." }] },
        },
      ],
    },
  ],
});

const chipOf = async (proposer: DocumentProposals["groups"][number]["proposer"]) => {
  const view = await mount({ proposals: proposed(proposer) });
  await view.userEvent('[data-bar-action="proposed-changes"]', "click");
  await view.settle(() => view.root.querySelector(`[data-proposal-mark="${rewrite}"]`) != null);
  return view.root.querySelector(`[data-proposal-mark="${rewrite}"]`) as HTMLElement;
};

describe("the mode a proposal served", () => {
  it("Given a run of each quadrant, Then its chip wears the two poles and names the quadrant", async () => {
    for (const [field, work, quadrant, icons] of [
      ["explore", "understand", "Reconnaissance", ["arrows-out-simple", "book-open-text"]],
      ["explore", "create", "Prototyping", ["arrows-out-simple", "pencil-simple-line"]],
      ["consolidate", "understand", "Synthesis", ["arrows-in-simple", "book-open-text"]],
      ["consolidate", "create", "Commitment support", ["arrows-in-simple", "pencil-simple-line"]],
    ] as const) {
      const chip = await chipOf(proposerOf({ agent: "codex", executedBy: "codex", mode: { field, work }, drift: [] }, []));
      const mark = chip.querySelector("[data-proposal-mode]");
      expect(mark?.getAttribute("aria-label")).toBe(quadrant);
      expect(Array.from(mark?.querySelectorAll("[data-icon]") ?? []).map((icon) => icon.getAttribute("data-icon"))).toEqual(icons);
      expect(chip.querySelector("[data-proposal-drift]") ?? null).toBeNull();
      await last?.idle();
      vi.unstubAllGlobals();
    }
  });

  it("Given a run that strayed from its mode, Then the chip says so in its line with the reason, and its answers stand", async () => {
    const chip = await chipOf(
      proposerOf({ agent: "codex", executedBy: "codex", mode: { field: "explore", work: "understand" }, drift: ["exploring, it rewrote, removed or moved 1 established block"] }, []),
    );
    expect(chip.querySelector("[data-proposal-drift]")?.textContent).toBe("Strayed from the mode: exploring, it rewrote, removed or moved 1 established block");
    expect(chip.querySelector(`[data-proposal-accept="${rewrite}"]`)).not.toBeNull();
    expect(chip.querySelector(`[data-proposal-reject="${rewrite}"]`)).not.toBeNull();
  });

  it("Given a run without a mode, Then the chip draws neither the mark nor the line", async () => {
    const chip = await chipOf(proposerOf({ agent: "codex", executedBy: "codex" }, []));
    expect(chip.querySelector("[data-proposal-mode]") ?? null).toBeNull();
    expect(chip.querySelector("[data-proposal-drift]") ?? null).toBeNull();
  });
});

describe("proposerOf", () => {
  it("reads the mode and drift an agent.run carries, and ignores a mode that names no pole", () => {
    expect(proposerOf({ agent: "codex", executedBy: "codex", mode: { field: "consolidate", work: "create" }, drift: ["a", 3, ""] }, [])).toEqual({
      kind: "agent",
      agent: "codex",
      executedBy: "codex",
      mode: { field: "consolidate", work: "create" },
      drift: ["a"],
    });
    expect(proposerOf({ agent: "codex", executedBy: "codex", mode: { field: "wander", work: "create" } }, [])).toEqual({ kind: "agent", agent: "codex", executedBy: "codex" });
    expect(proposerOf({ agent: "codex", executedBy: "codex", mode: { field: "explore", work: "make" } }, [])).toEqual({ kind: "agent", agent: "codex", executedBy: "codex" });
  });
});
