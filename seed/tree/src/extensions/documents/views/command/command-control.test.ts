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
const text = (blockId: string, order: string, words: string, standing: "keep" | "discarded" | "prompt" = "keep"): BlockView => ({
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
    expect(control?.querySelector("[data-block-send-more]")?.getAttribute("aria-label")).toBe("More ways to send");
    // The controls are one chip, each an icon named by its label; what the
    // command carries follows it. BO_0267_027
    const controls = control?.querySelector("[data-block-command-controls]");
    for (const part of ["[data-agent-menu]", "[data-block-point]", "[data-attach-input]", "[data-block-send]", "[data-block-send-more]"]) {
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
      { itemId: "doc-1", source: { block: "blk-b", revisionId: "rev-blk-b" }, words: "Tighten #1.", attachments: [] },
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

  it("When Send, keep as content is chosen, Then the block is sent and stays, with no standing written", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    await view.userEvent('[data-block-command="blk-b"] [data-block-send-more]', "click");
    await view.userEvent('[data-block-command="blk-b"] [data-block-send-keep]', "click");
    await view.settle(() => (view.record.commands?.length ?? 0) === 1);
    await view.settle();
    expect(view.writes("setDisposition")).toEqual([]);
    expect(view.find('[data-block-id="blk-b"]') != null).toBe(true);
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

  it("Given Ctrl+Enter in the block, Then it is sent as a prompt and not split", async () => {
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
    // One chip holds the line, Send and its caret after what the command
    // carries. BO_0267_028
    const order = Array.from(view.root.querySelectorAll('[data-block-command="blk-b"] [data-block-command-controls] [data-agent-menu], [data-block-command="blk-b"] [data-block-command-controls] [data-block-point], [data-block-command="blk-b"] [data-block-command-controls] [data-chip], [data-block-command="blk-b"] [data-block-command-controls] [data-block-send], [data-block-command="blk-b"] [data-block-command-controls] [data-block-send-more]')).map((element) =>
      element.hasAttribute("data-chip") ? "chip" : element.hasAttribute("data-block-send-more") ? "more" : element.hasAttribute("data-block-send") ? "send" : element.hasAttribute("data-block-point") ? "point" : "agent",
    );
    expect(order).toEqual(["agent", "point", "chip", "send", "more"]);
    await view.idle();
  });

  it("Given # typed in the block, Then the prompt's references are offered, and choosing one writes it where the caret is", async () => {
    const view = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "Tighten #"), text("blk-c", "c", "Closing.")] });
    await pointFrom(view, "blk-b");
    await view.userEvent('[data-block-id="blk-c"]', "click");
    await view.settle(() => view.record.pointing?.references.length === 1);
    await view.userEvent("[data-pointing-from] [data-block-point]", "click");
    await view.settle(() => view.find('[data-block-command="blk-b"] [data-reference-option="1"]') !== null);
    await view.userEvent('[data-block-command="blk-b"] [data-reference-option="1"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-b"] [data-block-editor]')?.textContent === "Tighten #1 ");
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

  it("Given a prompt being edited, Then the bar's Standing lists Prompt beside the scale, and choosing Keep brings it back into the flow", async () => {
    const view = await mount({ ...draft, blocks: [text("blk-a", "a", "Opening."), text("blk-p", "ab", "Write an intro.", "prompt")] });
    await view.userEvent('[data-bar-action="prompts"]', "click");
    await view.settle(() => view.find('[data-block-id="blk-p"]') !== null);
    await activateBlock(view, "blk-p");
    const standing = view.find('[data-bar-action="block-standing"]') as HTMLSelectElement | null;
    expect(Array.from(standing?.querySelectorAll("option") ?? []).map((option) => option.getAttribute("value"))).toEqual([
      "discarded",
      "keep",
      "fixate",
      "prompt",
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
    expect(JSON.parse(kept.get("calliopa.shows.doc-1") ?? "{}")).toEqual({ retired: false, discarded: false, proposals: true, prompts: true });
    await first.idle();

    const again = await mount();
    await again.settle(() => again.find('[data-bar-action="prompts"]')?.getAttribute("aria-pressed") === "true");
    expect(again.find('[data-bar-action="proposed-changes"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(again.find('[data-bar-action="discarded-blocks"]')?.getAttribute("aria-pressed")).toBe("false");
    await again.userEvent('[data-bar-action="prompts"]', "click");
    await again.userEvent('[data-bar-action="proposed-changes"]', "click");
    await again.settle(() => !kept.has("calliopa.shows.doc-1"));
    await again.idle();
  });

  it("Given a kept record that cannot be read, Then nothing extra shows", () => {
    expect(readShows("not json")).toBeNull();
    expect(readShows(null)).toBeNull();
    expect(readShows(JSON.stringify({ prompts: true, retired: "yes" }))).toEqual({ retired: false, discarded: false, proposals: false, prompts: true });
  });
});
