import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../../server/assemble";
import {
  activateBlock,
  documentsApi,
  mountEditor,
  pointFrom,
  stopPointing,
  type SentCommand,
} from "../testing/editor-harness";
import { readShows } from "../block-editor";

/**
 * A block is the command (BO_0267_018), pressed through the editor's own JSX:
 * the control on the block being edited, sending it as a prompt or as
 * content, its refusals, `Ctrl`/`Cmd`+`Enter`, pointing from it with marks of
 * its own, `#` offering them, a file dropped on it, words composed into a new
 * block, and *Show prompts*.
 */
const text = (blockId: string, order: string, words: string, standing: "keep" | "prompt" = "keep"): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing,
  runs: [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "Tighten #1."), text("blk-c", "c", "Closing.")],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

type Runs = Parameters<typeof documentsApi>[2] extends infer O ? (O extends { runs?: infer R } ? R : never) : never;

type FloorRefusal = NonNullable<NonNullable<Parameters<typeof documentsApi>[2]>["refuseByFloor"]>;

async function mount(document: DocumentView = draft, runs: Runs = [], refuseByFloor?: FloorRefusal) {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent, { runs, ...(refuseByFloor === undefined ? {} : { refuseByFloor }) }));
  const view = await mountEditor(document);
  const find = (selector: string) => (view.root.querySelector(selector) as HTMLElement | null) ?? null;
  const writes = (command: string) => sent.filter((entry) => entry.body["command"] === command).map((entry) => entry.body);
  return { ...view, sent, find, writes };
}

describe("the command control", () => {
  it("Given a block edited, Then the control stands on it alone, its parts named", async () => {
    const view = await mount();
    expect(view.find("[data-block-command]")).toBeNull();
    await activateBlock(view, "blk-b");
    expect(view.root.querySelectorAll("[data-block-command]").length).toBe(1);
    const control = view.find('[data-block-command="blk-b"]');
    expect(control?.getAttribute("aria-label")).toBe("Command");
    expect(control?.querySelector("[data-agent-menu]")?.getAttribute("aria-label")).toBe("Agent: Claude Code");
    expect(control?.querySelector("[data-block-point]")?.getAttribute("aria-label")).toBe("Point from this block");
    expect(control?.querySelector("[data-attach-input]")?.getAttribute("aria-label")).toBe("Attach files");
    expect(control?.querySelector("[data-block-send]")?.getAttribute("aria-label")).toBe("Send as prompt");
    // The tooltip names the key that sends. DO_0015_007
    expect(control?.querySelector("[data-block-send]")?.getAttribute("title")).toBe("Send as prompt · Ctrl+Enter");
    // No caret and no second way to send; the toggle says how. DO_0025_001
    expect(control?.querySelector("[data-block-send-more]") ?? null).toBeNull();
    expect(control?.querySelector("[data-block-keep]")?.getAttribute("aria-label")).toBe("Keep as content");
    expect(control?.querySelector("[data-block-keep]")?.getAttribute("aria-pressed")).toBe("false");
    // The controls are one chip, each an icon named by its label; what the
    // command carries follows it. BO_0267_027
    const controls = control?.querySelector("[data-block-command-controls]");
    for (const part of ["[data-agent-menu]", '[data-block-mode="field"]', '[data-block-mode="work"]', "[data-block-point]", "[data-attach-input]", "[data-block-keep]", "[data-block-send]"]) {
      expect(controls?.querySelector(part) != null).toBe(true);
    }
    expect(control?.querySelector("[data-block-send]")?.textContent?.trim()).toBe("");
    await view.idle();
  });

  it("Given the control, Then the command's speed stands after the agent, Fast until pressed, and a press makes it Thorough for the next command", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    const speed = () => view.find('[data-block-command="blk-b"] [data-block-command-controls] .speed-toggle');
    // BO_0269_015
    expect(speed()?.getAttribute("aria-label")).toBe("Speed: Fast");
    expect(speed()?.getAttribute("title")).toBe("Fast — press for thorough");
    expect(speed()?.getAttribute("data-speed")).toBe("fast");
    const controls = Array.from(view.root.querySelectorAll('[data-block-command="blk-b"] [data-block-command-controls] [data-agent-menu], [data-block-command="blk-b"] [data-block-command-controls] .speed-toggle, [data-block-command="blk-b"] [data-block-command-controls] [data-block-point]'));
    expect(controls.map((element) => (element.hasAttribute("data-agent-menu") ? "agent" : element.hasAttribute("data-block-point") ? "point" : "speed"))).toEqual(["agent", "speed", "point"]);
    await view.userEvent('[data-block-command="blk-b"] .speed-toggle', "click");
    await view.settle(() => speed()?.getAttribute("data-speed") === "thorough");
    expect(speed()?.getAttribute("aria-label")).toBe("Speed: Thorough");
    await view.idle();
  });

  it("When Send is pressed, Then the block's revision is sent as the command and the block becomes a prompt, leaving the flow", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    await view.userEvent('[data-block-command="blk-b"] [data-block-send]', "click");
    await view.settle(() => view.writes("setDisposition").length === 1);
    expect(view.record.commands).toEqual([
      { itemId: "doc-1", source: { block: "blk-b", revisionId: "rev-blk-b" }, words: "Tighten #1.", attachments: [], mode: { field: "explore", work: "create" } },
    ]);
    expect(view.writes("setDisposition")).toEqual([
      { command: "setDisposition", blockId: "blk-b", baseRevisionId: "rev-blk-b", standing: "prompt" },
    ]);
    await view.settle(() => view.find('[data-block-id="blk-b"]') === null);
    // The bar offers to take the standing back, naming it. CA_0058_011
    expect(
      view.find('[data-bar-action="take-back-standing"]')?.getAttribute("aria-label"),
    ).toBe("Take back: Sent as prompt “Tighten #1.”");
    await view.idle();
  });

  it("Given the standing written inside the kernel's floor after the block's own save, Then it is written again after the floor and the block leaves the flow", async () => {
    const view = await mount(draft, [], { command: "setDisposition", times: 1 });
    await activateBlock(view, "blk-b");
    await view.userEvent('[data-block-command="blk-b"] [data-block-send]', "click");
    await view.settle(() => view.writes("setDisposition").length === 2);
    expect(view.writes("setDisposition")).toEqual([
      { command: "setDisposition", blockId: "blk-b", baseRevisionId: "rev-blk-b", standing: "prompt" },
      { command: "setDisposition", blockId: "blk-b", baseRevisionId: "rev-blk-b", standing: "prompt" },
    ]);
    await view.settle(() => view.find('[data-block-id="blk-b"]') === null);
    expect(view.find("[data-block-send-refusal]")).toBeNull();
    await view.idle();
  });

  it("When Keep as content is on and Send is pressed, Then Send says so, the block is sent and stays with no standing written, and the toggle stays on", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    const send = () => view.find('[data-block-command="blk-b"] [data-block-send]');
    await view.userEvent('[data-block-command="blk-b"] [data-block-keep]', "click");
    await view.settle(() => view.find('[data-block-command="blk-b"] [data-block-keep]')?.getAttribute("aria-pressed") === "true");
    expect(send()?.getAttribute("aria-label")).toBe("Send, keep as content");
    expect(send()?.getAttribute("title")).toBe("Send, keep as content · Ctrl+Enter");
    await view.userEvent('[data-block-command="blk-b"] [data-block-send]', "click");
    await view.settle(() => (view.record.commands?.length ?? 0) === 1);
    await view.settle();
    expect(view.writes("setDisposition")).toEqual([]);
    expect(view.find('[data-block-id="blk-b"]') != null).toBe(true);
    expect(view.find('[data-block-command="blk-b"] [data-block-keep]')?.getAttribute("aria-pressed")).toBe("true");
    await view.idle();
  });

  it("Given Keep as content on, When Ctrl+Enter is pressed, Then the block is kept as content, and the toggle is this block's alone", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    await view.userEvent('[data-block-command="blk-b"] [data-block-keep]', "click");
    await view.settle(() => view.find('[data-block-command="blk-b"] [data-block-keep]')?.getAttribute("aria-pressed") === "true");
    const editor = view.find('[data-block-id="blk-b"] [data-block-editor]') as HTMLElement;
    const key = editor.ownerDocument.createEvent("Event");
    key.initEvent("keydown", true, true);
    Object.defineProperty(key, "key", { value: "Enter" });
    Object.defineProperty(key, "ctrlKey", { value: true });
    editor.dispatchEvent(key);
    await view.settle(() => (view.record.commands?.length ?? 0) === 1);
    await view.settle();
    expect(view.writes("setDisposition")).toEqual([]);
    await activateBlock(view, "blk-c");
    expect(view.find('[data-block-command="blk-c"] [data-block-keep]')?.getAttribute("aria-pressed")).toBe("false");
    await view.idle();
  });

  it("Given a block sent before as content and nothing on this device, Then its toggle reads on and its mode is its latest run's; a block sent as a prompt reads off", async () => {
    const consolidating = { field: "consolidate", work: "understand" };
    const view = await mount(draft, [
      { id: "arun-2", goal: "Tighten #1.", status: "completed", agent: "codex", group: null, source: "blk-b", touched: [], startedAt: 2, references: [], mode: consolidating } as never,
    ]);
    await activateBlock(view, "blk-b");
    await view.settle(() => view.find('[data-block-command="blk-b"] [data-block-keep]')?.getAttribute("aria-pressed") === "true");
    expect(view.find('[data-block-command="blk-b"] [data-block-mode="field"]')?.getAttribute("data-block-mode-pole")).toBe("consolidate");
    expect(view.find('[data-block-command="blk-b"] [data-block-mode="work"]')?.getAttribute("data-block-mode-pole")).toBe("understand");
    await activateBlock(view, "blk-a");
    expect(view.find('[data-block-command="blk-a"] [data-block-keep]')?.getAttribute("aria-pressed")).toBe("false");
    await view.idle();
  });

  it("Given the mode switched on one block, Then that block alone changes, its send carries it, and a block never sent then starts from it", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    const pole = (blockId: string, axis: string) => view.find(`[data-block-command="${blockId}"] [data-block-mode="${axis}"]`)?.getAttribute("data-block-mode-pole");
    expect([pole("blk-b", "field"), pole("blk-b", "work")]).toEqual(["explore", "create"]);
    await view.userEvent('[data-block-command="blk-b"] [data-block-mode="field"]', "click");
    await view.settle(() => pole("blk-b", "field") === "consolidate");
    expect(view.find('[data-block-command="blk-b"] [data-block-mode="field"]')?.getAttribute("aria-label")).toBe("Consolidating — switch to explore");
    await activateBlock(view, "blk-c");
    expect([pole("blk-c", "field"), pole("blk-c", "work")]).toEqual(["explore", "create"]);
    await activateBlock(view, "blk-b");
    expect(pole("blk-b", "field")).toBe("consolidate");
    await view.userEvent('[data-block-command="blk-b"] [data-block-send]', "click");
    await view.settle(() => (view.record.commands?.length ?? 0) === 1);
    expect(view.record.commands?.[0]?.mode).toEqual({ field: "consolidate", work: "create" });
    // The document's last sent mode is written, told to the shell, and is
    // where a block never sent starts. DO_0025_003 DO_0025_009
    await view.settle(() => view.record.mode?.field === "consolidate");
    await activateBlock(view, "blk-a");
    expect([pole("blk-a", "field"), pole("blk-a", "work")]).toEqual(["consolidate", "create"]);
    await view.idle();
  });

  it("Given the shell refuses the command, Then the refusal is said beside the control and nothing is written", async () => {
    const view = await mount();
    view.record.sendAnswer = { ok: false, error: "The agent is busy with another run." };
    await activateBlock(view, "blk-b");
    await view.userEvent('[data-block-command="blk-b"] [data-block-send]', "click");
    await view.settle(() => view.find("[data-block-send-refusal]") !== null);
    expect(view.find("[data-block-send-refusal]")?.textContent).toBe("The agent is busy with another run.");
    expect(view.writes("setDisposition")).toEqual([]);
    await view.idle();
  });

  it("Given an empty block, Then Send is refused in words and nothing is sent", async () => {
    const view = await mount({ ...draft, blocks: [...draft.blocks, text("blk-e", "e", "")] });
    await activateBlock(view, "blk-e");
    await view.userEvent('[data-block-command="blk-e"] [data-block-send]', "click");
    await view.settle(() => view.find("[data-block-send-refusal]") !== null);
    expect(view.find("[data-block-send-refusal]")?.textContent).toBe("Write the command in the block before sending it.");
    expect(view.record.commands ?? []).toEqual([]);
    await view.idle();
  });

  it("Given Ctrl+Enter in the block with Keep as content off, Then it is sent as a prompt and not split", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    // The surface hears the key on the page, as the browser delivers it.
    const editor = view.find('[data-block-id="blk-b"] [data-block-editor]') as HTMLElement;
    const key = editor.ownerDocument.createEvent("Event");
    key.initEvent("keydown", true, true);
    Object.defineProperty(key, "key", { value: "Enter" });
    Object.defineProperty(key, "ctrlKey", { value: true });
    editor.dispatchEvent(key);
    await view.settle(() => view.writes("setDisposition").length === 1);
    expect(view.record.commands?.[0]?.source).toEqual({ block: "blk-b", revisionId: "rev-blk-b" });
    expect(view.writes("split")).toEqual([]);
    await view.idle();
  });
});

describe("pointing from a prompt block", () => {
  it("Given marks made from one block, Then another block starts with none, and the first has its own back", async () => {
    const view = await mount();
    await pointFrom(view, "blk-b");
    await view.userEvent('[data-block-id="blk-a"]', "click");
    await view.settle(() => view.record.pointing?.references.length === 1);
    expect(view.find('[data-pointing-from] [data-block-command="blk-b"]') != null).toBe(true);
    // The prompt is not marked from itself.
    await view.userEvent('[data-block-id="blk-b"]', "click");
    expect(view.record.pointing?.references.map((reference) => reference.blockId)).toEqual(["blk-a"]);
    await stopPointing(view);

    await pointFrom(view, "blk-c");
    await view.settle(() => view.record.pointing?.references.length === 0);
    await view.userEvent('[data-block-id="blk-b"]', "click");
    await view.settle(() => view.record.pointing?.references[0]?.blockId === "blk-b");
    expect(view.record.pointing?.references.map((reference) => reference.number)).toEqual([1]);
    await stopPointing(view);

    await activateBlock(view, "blk-b");
    await view.settle(() => view.record.pointing?.references[0]?.blockId === "blk-a");
    await view.idle();
  });

  it("Given a block sent before and no marks on this device, Then its latest run's references come back as its marks", async () => {
    const view = await mount(draft, [
      { id: "arun-2", goal: "Tighten #1.", status: "completed", agent: "codex", group: null, source: "blk-b", touched: [], startedAt: 2, references: [{ number: 1, blockId: "blk-c", kind: "block" }] },
      { id: "arun-1", goal: "Older.", status: "completed", agent: "codex", group: null, source: "blk-b", touched: [], startedAt: 1, references: [{ number: 1, blockId: "blk-a", kind: "block" }] },
    ]);
    await activateBlock(view, "blk-b");
    await view.settle(() => view.record.pointing?.references.length === 1);
    expect(view.record.pointing?.references.map((reference) => [reference.number, reference.blockId])).toEqual([[1, "blk-c"]]);
    expect(view.find('[data-block-command="blk-b"] [data-chip="1"]') != null).toBe(true);
    // One chip holds the line: agent, speed, the two modes, point, attach,
    // what the command carries, Keep as content and Send. BO_0267_028
    // DO_0025_005
    const line = '[data-block-command="blk-b"] [data-block-command-controls]';
    const order = Array.from(
      view.root.querySelectorAll(
        ["[data-agent-menu]", ".speed-toggle", "[data-block-mode]", "[data-block-point]", "[data-attach-input]", "[data-chip]", "[data-block-keep]", "[data-block-send]"].map((part) => `${line} ${part}`).join(", "),
      ),
    ).map((element) =>
      element.hasAttribute("data-chip") ? "chip"
      : element.hasAttribute("data-block-keep") ? "keep"
      : element.hasAttribute("data-block-send") ? "send"
      : element.hasAttribute("data-block-point") ? "point"
      : element.hasAttribute("data-attach-input") ? "attach"
      : element.hasAttribute("data-block-mode") ? `mode-${element.getAttribute("data-block-mode")}`
      : element.classList.contains("speed-toggle") ? "speed"
      : "agent",
    );
    expect(order).toEqual(["agent", "speed", "mode-field", "mode-work", "point", "attach", "chip", "keep", "send"]);
    await view.idle();
  });

  it("Given # typed in the block, Then the prompt's references are offered, and choosing one writes it where the caret is", async () => {
    const view = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "Tighten #"), text("blk-c", "c", "Closing.")] });
    await pointFrom(view, "blk-b");
    await view.userEvent('[data-block-id="blk-c"]', "click");
    await view.settle(() => view.record.pointing?.references.length === 1);
    await view.userEvent("[data-pointing-from] [data-block-point]", "click");
    await view.settle(() => view.find('[data-block-command="blk-b"] [data-reference-option="1"]') !== null);
    // The list follows the control's row, so it opens below the block and
    // its words rather than over them. DO_0033_002
    const row = view.find('[data-block-command="blk-b"] [data-block-command-row]');
    expect(row?.nextElementSibling?.hasAttribute("data-block-reference-list")).toBe(true);
    await view.userEvent('[data-block-command="blk-b"] [data-reference-option="1"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-b"] [data-block-editor]')?.textContent === "Tighten #1 ");
    await view.idle();
  });

  it("Given # typed in a prompt, Then the document's blocks are offered after the marks, and choosing one marks it and writes its number (BO_0304_016)", async () => {
    const view = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "Tighten #"), text("blk-c", "c", "Closing.")] });
    await pointFrom(view, "blk-b");
    await view.userEvent('[data-block-id="blk-c"]', "click");
    await view.settle(() => view.record.pointing?.references.length === 1);
    await view.userEvent("[data-pointing-from] [data-block-point]", "click");
    await view.settle(() => view.find('[data-block-command="blk-b"] [data-reference-option="1"]') !== null);
    // One list: the mark first, then the blocks not yet marked — the marked
    // closing block stands as its mark, the opening block as a block.
    const list = view.find("[data-block-reference-list]");
    expect(Array.from(list?.querySelectorAll("button") ?? []).map((option) => option.getAttribute("data-reference-option") ?? option.getAttribute("data-block-reference-option"))).toEqual(["1", "blk-a"]);
    await view.userEvent('[data-block-command="blk-b"] [data-block-reference-option="blk-a"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-b"] [data-block-editor]')?.textContent === "Tighten #2 ");
    await view.settle(() => view.record.pointing?.references.length === 2);
    expect(view.record.pointing?.references.map((reference) => [reference.number, reference.blockId])).toEqual([[1, "blk-c"], [2, "blk-a"]]);
    expect(view.root.querySelectorAll("[data-block-ref]").length).toBe(0);
    await view.idle();
  });
});

describe("a file dropped on the block being edited", () => {
  it("Given a file dropped on the block, Then it becomes a chip of the block's command, and a drop on another block attaches nothing", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    const file = new File(["# Plan\n"], "plan.md", { type: "text/markdown" });
    await view.userEvent('[data-block-id="blk-a"]', "drop", { dataTransfer: { files: [file] } });
    await view.userEvent('[data-block-id="blk-b"]', "drop", { dataTransfer: { files: [file] } });
    await view.settle(() => view.find('[data-block-command="blk-b"] [data-attachment-chip="plan.md"]') !== null);
    expect(view.root.querySelectorAll("[data-attachment-chip]").length).toBe(1);
    await view.idle();
  });
});

describe("words composed for the document's next command", () => {
  it("Given words asked for, Then a new block holding them is inserted after the block being edited, and nothing is sent", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    view.record.composeBlock = "Challenge the framing: ";
    await view.userEvent("[data-harness-compose]", "click");
    await view.settle(() => view.writes("insert").length === 1);
    expect(view.writes("insert")).toEqual([
      { command: "insert", block: { kind: "text", runs: [{ text: "Challenge the framing: " }] }, placement: { after: "blk-a" } },
    ]);
    expect(view.record.commands ?? []).toEqual([]);
    await view.idle();
  });
});

describe("Show prompts", () => {
  it("Given a prompt and a block sent while kept as content, Then neither shows as a prompt until the toggle, and then each carries the glyph", async () => {
    const view = await mount(
      { ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-p", "ab", "Write an intro.", "prompt"), text("blk-b", "b", "Tighten #1.")] },
      [{ id: "arun-1", goal: "Tighten #1.", status: "completed", agent: "codex", group: null, source: "blk-b", touched: [], startedAt: 1, references: [] }],
    );
    expect(view.find('[data-block-id="blk-p"]')).toBeNull();
    expect(view.find('[data-block-id="blk-b"] [data-card-label="prompt"]')).toBeNull();
    const toggle = view.find('[data-bar-action="prompts"]');
    expect(toggle?.getAttribute("aria-label")).toBe("Show prompts");
    await view.userEvent('[data-bar-action="prompts"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-p"]') !== null);
    expect(view.find('[data-block-id="blk-p"]')?.getAttribute("data-standing")).toBe("prompt");
    expect(view.find('[data-block-id="blk-p"] [data-card-label="prompt"]') != null).toBe(true);
    expect(view.find('[data-block-id="blk-b"]')?.getAttribute("data-prompted")).toBe("true");
    expect(view.find('[data-block-id="blk-a"] [data-card-label="prompt"]')).toBeNull();
    await view.idle();
  });

  it("Given a revealed prompt turned to, Then its own block bar carries Keep as content and Fixate, the top bar no standing, and Keep as content is taken back", async () => {
    const view = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-p", "ab", "Write an intro.", "prompt")] });
    await view.userEvent('[data-bar-action="prompts"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-p"]') !== null);
    await view.userEvent('[data-block-id="blk-p"] [data-block-reading]', "focus");
    await view.settle(() => view.find('[data-block-id="blk-p"] [data-block-bar]') !== null);
    // The bar above the document carries no standing; the prompt's own bar
    // sets it back. DO_0031_002
    expect(view.find('[data-bar-action="block-standing"]')).toBeNull();
    expect(
      Array.from(view.find('[data-block-id="blk-p"] [data-block-bar]')?.querySelectorAll("[data-standing-option]") ?? []).map((control) =>
        control.getAttribute("aria-label"),
      ),
    ).toEqual(["Keep as content", "Fixate"]);
    await view.userEvent('[data-block-id="blk-p"] [data-standing-option="keep"]', "click");
    await view.settle(() => view.writes("setDisposition").length === 1);
    expect(view.writes("setDisposition")).toEqual([
      { command: "setDisposition", blockId: "blk-p", baseRevisionId: "rev-blk-p", standing: "keep" },
    ]);
    await view.settle(() => view.find('[data-bar-action="take-back-standing"]')?.hasAttribute("disabled") === false);
    await view.userEvent('[data-bar-action="take-back-standing"]', "click");
    await view.settle(() => view.writes("setDisposition").length === 2);
    expect(view.writes("setDisposition")[1]).toMatchObject({ blockId: "blk-p", standing: "prompt" });
    await view.idle();
  });

  it("Given a revealed prompt turned to, When its Fixate is pressed, Then the prompt is fixated", async () => {
    const view = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-p", "ab", "Write an intro.", "prompt")] });
    await view.userEvent('[data-bar-action="prompts"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-p"]') !== null);
    await view.userEvent('[data-block-id="blk-p"] [data-block-reading]', "focus");
    await view.settle(() => view.find('[data-block-id="blk-p"] [data-standing-option="fixate"]') !== null);
    await view.userEvent('[data-block-id="blk-p"] [data-standing-option="fixate"]', "click");
    await view.settle(() => view.writes("setDisposition").length === 1);
    expect(view.writes("setDisposition")).toEqual([
      { command: "setDisposition", blockId: "blk-p", baseRevisionId: "rev-blk-p", standing: "fixate" },
    ]);
    await view.idle();
  });
});

describe("pointing keeps the prompt edited (BO_0267_023)", () => {
  it("Given pointing from the block being edited, Then it stays edited while other rows are marked, and ending the pointing leaves it edited", async () => {
    const view = await mount();
    await pointFrom(view, "blk-b");
    expect(view.find('[data-block-id="blk-b"] [data-block-editor]') != null).toBe(true);
    await view.userEvent('[data-block-id="blk-a"]', "click");
    await view.settle(() => view.record.pointing?.references.length === 1);
    expect(view.find('[data-block-id="blk-b"] [data-block-editor]') != null).toBe(true);
    expect(view.find('[data-block-id="blk-a"] [data-block-editor]')).toBeNull();
    // The page's own press listener, which ends an edit on a press outside
    // it, leaves the prompt edited while pointing.
    const other = view.find('[data-block-id="blk-c"]') as HTMLElement;
    // `Element`, which the listener tests its targets against and the
    // harness does not install globally: an element is what it answers to.
    vi.stubGlobal("Element", {
      [Symbol.hasInstance]: (value: unknown) => (value as { nodeType?: number } | null)?.nodeType === 1,
    });
    for (const type of ["pointerdown", "click"]) {
      const press = other.ownerDocument.createEvent("Event");
      press.initEvent(type, true, true);
      other.dispatchEvent(press);
    }
    await view.settle();
    await view.settle();
    expect(view.find('[data-block-id="blk-b"] [data-block-editor]') != null).toBe(true);
    await stopPointing(view);
    expect(view.find('[data-block-id="blk-b"] [data-block-editor]') != null).toBe(true);
    await view.idle();
  });
});

describe("the prompt's label on its card (BO_0267_015, DO_0008_005)", () => {
  it("Given a prompt shown, Then its top border carries the terminal glyph and the word, and nothing stands in its gutter", async () => {
    const view = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-p", "ab", "Write an intro.", "prompt")] });
    await view.userEvent('[data-bar-action="prompts"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-p"]') !== null);
    const label = view.find('[data-block-id="blk-p"] [data-card-label="prompt"]');
    expect(label?.querySelector('[data-icon="terminal-window"]') != null).toBe(true);
    expect(label?.querySelector(".block-card-label__word")?.textContent).toBe("prompt");
    await view.idle();
  });
});

describe("what a document shows is remembered (BO_0267_022)", () => {
  it("Given prompts and proposed changes shown, When the document opens again, Then both show again, and turned off they stay off", async () => {
    const kept = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => kept.get(key) ?? null,
        setItem: (key: string, value: string) => void kept.set(key, value),
        removeItem: (key: string) => void kept.delete(key),
      },
    });
    const first = await mount();
    await first.userEvent('[data-bar-action="prompts"]', "click");
    await first.userEvent('[data-bar-action="proposed-changes"]', "click");
    await first.settle(() => kept.get("calliopa.shows.doc-1") !== undefined && JSON.parse(kept.get("calliopa.shows.doc-1") ?? "{}").proposals === true);
    expect(JSON.parse(kept.get("calliopa.shows.doc-1") ?? "{}")).toEqual({ removed: false, proposals: true, prompts: true });
    await first.idle();

    const again = await mount();
    await again.settle(() => again.find('[data-bar-action="prompts"]')?.getAttribute("aria-pressed") === "true");
    expect(again.find('[data-bar-action="proposed-changes"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(again.find('[data-bar-action="removed"]')?.getAttribute("aria-pressed")).toBe("false");
    await again.userEvent('[data-bar-action="prompts"]', "click");
    await again.userEvent('[data-bar-action="proposed-changes"]', "click");
    await again.settle(() => !kept.has("calliopa.shows.doc-1"));
    await again.idle();
  });

  it("Given a kept record that cannot be read, Then nothing extra shows", () => {
    expect(readShows("not json")).toBeNull();
    expect(readShows(null)).toBeNull();
    expect(readShows(JSON.stringify({ prompts: true, retired: "yes" }))).toEqual({ removed: false, proposals: false, prompts: true });
    // A record kept under the toggle's old name reads as Show removed.
    // BO_0315_015
    expect(readShows(JSON.stringify({ retired: true }))).toEqual({ removed: true, proposals: false, prompts: false });
  });
});

describe("a block's command choices on the device (DO_0025_002)", () => {
  it("Given a choice made on a block, When the document opens again, Then the device brings it back, over what the block was sent with", async () => {
    const kept = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => kept.get(key) ?? null,
        setItem: (key: string, value: string) => void kept.set(key, value),
        removeItem: (key: string) => void kept.delete(key),
      },
    });
    const first = await mount();
    await activateBlock(first, "blk-b");
    await first.userEvent('[data-block-command="blk-b"] [data-block-keep]', "click");
    await first.userEvent('[data-block-command="blk-b"] [data-block-mode="work"]', "click");
    await first.settle(() => kept.has("calliopa.command.doc-1.blk-b") && JSON.parse(kept.get("calliopa.command.doc-1.blk-b") ?? "{}").mode?.work === "understand");
    expect(JSON.parse(kept.get("calliopa.command.doc-1.blk-b") ?? "{}")).toEqual({ keep: true, mode: { field: "explore", work: "understand" } });
    await first.idle();

    // Sent before as a prompt: what was sent says off, the device says on.
    const again = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "Tighten #1.", "prompt"), text("blk-c", "c", "Closing.")] }, [
      { id: "arun-1", goal: "Tighten #1.", status: "completed", agent: "codex", group: null, source: "blk-b", touched: [], startedAt: 1, references: [] },
    ]);
    await again.userEvent('[data-bar-action="prompts"]', "click");
    await again.settle(() => again.find('[data-block-id="blk-b"]') !== null);
    await activateBlock(again, "blk-b");
    await again.settle(() => again.find('[data-block-command="blk-b"] [data-block-keep]')?.getAttribute("aria-pressed") === "true");
    expect(again.find('[data-block-command="blk-b"] [data-block-mode="work"]')?.getAttribute("data-block-mode-pole")).toBe("understand");
    await again.idle();
  });
});

describe("the control hangs below its block (DO_0033)", () => {
  const css = readFileSync(new URL("../block-editor.css", import.meta.url), "utf8");
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {`);
    expect(at).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it("Given the control, Then it hangs from the block's lower edge and grows downward only, so a wrapped row never covers the block", () => {
    const control = rule(".block-command");
    expect(control).toMatch(/top:\s*calc\(100% \+ 1px\);/u);
    expect(control).toMatch(/height:\s*0;/u);
    expect(control).toMatch(/flex-direction:\s*column;/u);
    expect(control).toMatch(/justify-content:\s*flex-start;/u);
  });

  it("Given the # list, Then it keeps its height in the zero-height column, below the row", () => {
    const list = rule(".block-command__references");
    expect(list).toMatch(/flex:\s*none;/u);
    expect(list).toMatch(/max-height:\s*min\(14rem, 40vh\);/u);
    expect(list).toMatch(/margin:\s*0\.375rem 0 0;/u);
  });

  it("Given a refusal, Then it is the next item down the column, not laid over the row", () => {
    const notice = rule(".block-command__notice");
    expect(notice).toMatch(/flex:\s*none;/u);
    expect(notice).not.toMatch(/position:\s*absolute;/u);
  });
});
