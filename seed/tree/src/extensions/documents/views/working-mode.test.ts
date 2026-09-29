import { afterEach, describe, expect, it, vi } from "vitest";

import { proposerOf } from "../lib/proposals";
import type { DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * The working mode in the document's bar and on a proposal's chip, pressed in
 * Qwik's render harness (`BO_0306`): two toggles lead the *Work* group, each
 * wearing the pole in force; a press switches the pole, writes it for the
 * person and tells the shell, which hands it to every run the document
 * starts; a refused write puts the pole back and says so; and a proposal's
 * chip names the mode its run served and where the run strayed from it.
 * BO_0306_013 BO_0306_015
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

const control = (root: HTMLElement, id: string) => root.querySelector(`[data-bar-action="${id}"]`) as HTMLElement | null;
const shown = (root: HTMLElement, id: string) => ({
  icon: control(root, id)?.querySelector("[data-icon]")?.getAttribute("data-icon"),
  name: control(root, id)?.getAttribute("aria-label"),
  pressed: control(root, id)?.getAttribute("aria-pressed") ?? null,
});

describe("the working mode's toggles", () => {
  it("Given a document whose mode was never set, Then the two toggles lead the Work group showing explore and create, and the shell is told", async () => {
    const view = await mount();
    const work = view.root.querySelector('[data-bar-group="work"]');
    expect(Array.from(work?.querySelectorAll("[data-bar-action]") ?? []).map((action) => action.getAttribute("data-bar-action")).slice(0, 3)).toEqual([
      "working-mode-field",
      "working-mode-work",
      "work-in-proposal",
    ]);
    // Neither pole is the pressed one: the control shows the pole in force.
    expect(shown(view.root, "working-mode-field")).toEqual({ icon: "arrows-out-simple", name: "Exploring — switch to consolidate", pressed: null });
    expect(shown(view.root, "working-mode-work")).toEqual({ icon: "pencil-simple-line", name: "Creating — switch to understand", pressed: null });
    expect(view.record.mode).toEqual({ field: "explore", work: "create" });
  });

  it("Given a mode the person set before, Then the toggles show it as the document opens", async () => {
    const view = await mount({ mode: { field: "consolidate", work: "understand" } });
    expect(shown(view.root, "working-mode-field").icon).toBe("arrows-in-simple");
    expect(shown(view.root, "working-mode-work").icon).toBe("book-open-text");
    expect(view.record.mode).toEqual({ field: "consolidate", work: "understand" });
  });

  it("Given each toggle pressed, Then its pole switches at once, is written for the person and is what the next run carries", async () => {
    const view = await mount();
    await view.userEvent('[data-bar-action="working-mode-field"]', "click");
    await view.settle(() => view.modes.length === 1);
    expect(shown(view.root, "working-mode-field")).toEqual({ icon: "arrows-in-simple", name: "Consolidating — switch to explore", pressed: null });
    expect(view.modes).toEqual([{ field: "consolidate", work: "create" }]);
    expect(view.record.mode).toEqual({ field: "consolidate", work: "create" });

    await view.userEvent('[data-bar-action="working-mode-work"]', "click");
    await view.settle(() => view.modes.length === 2);
    expect(shown(view.root, "working-mode-work").icon).toBe("book-open-text");
    expect(view.modes[1]).toEqual({ field: "consolidate", work: "understand" });
    expect(view.record.mode).toEqual({ field: "consolidate", work: "understand" });
  });

  it("Given the kernel refuses the write, Then the pole is put back, the shell keeps the mode in force and the bar's notice says so", async () => {
    const view = await mount({ modeRefused: true });
    await view.userEvent('[data-bar-action="working-mode-work"]', "click");
    await view.settle(() => view.modes.length === 1 && (view.root.textContent ?? "").includes("could not be switched"));
    expect(shown(view.root, "working-mode-work").icon).toBe("pencil-simple-line");
    expect(view.record.mode).toEqual({ field: "explore", work: "create" });
    expect(view.root.textContent).toContain("The working mode could not be switched to understand");
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
