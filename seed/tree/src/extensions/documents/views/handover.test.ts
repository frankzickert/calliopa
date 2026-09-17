import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { SAVE_PAUSE_MS } from "./block-editor";
import {
  documentsApi,
  mountEditor,
  type SentCommand,
} from "./testing/editor-harness";

/**
 * Switching the edited block without passing through a page with no editor,
 * and Enter drawn before the graph answers. CA_0045_003 CA_0045_005
 *
 * The keyboard itself is a phone's, and the walk-through judges it
 * (`CA_0045_006`). What the harness can prove is what closed it: between two
 * editors there was a render with none, for as long as a read took. Every
 * write here takes a round trip's time, and a sampler flushing the renders
 * throughout counts the editors each render left on the page.
 */
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    {
      kind: "text",
      blockId: "blk-a",
      revisionId: "rev-a",
      containmentId: "c-a",
      order: "a",
      role: "paragraph",
      standing: "neutral",
      runs: [{ text: "Opening." }],
    },
    {
      kind: "text",
      blockId: "blk-b",
      revisionId: "rev-b",
      containmentId: "c-b",
      order: "b",
      role: "paragraph",
      standing: "neutral",
      runs: [{ text: "The storm arrives before the lights go out." }],
    },
    {
      kind: "text",
      blockId: "blk-c",
      revisionId: "rev-c",
      containmentId: "c-c",
      order: "c",
      role: "paragraph",
      standing: "neutral",
      runs: [{ text: "Closing." }],
    },
  ],
};

const STORM = "The storm arrives before the lights go out.";
const ROUND_TRIP_MS = 40;

/** The editor last mounted, settled before the next test mounts its own: a
 * render or a write left under way collides with the next test's container. */
let last: { settle: () => Promise<void>; idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 4 * ROUND_TRIP_MS));
  await last?.settle();
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

const mount = async (
  options: { refuseSplits?: boolean; writeDelayMs?: number } = {},
) => {
  const sent: SentCommand[] = [];
  const reads: string[] = [];
  const api = documentsApi(draft, sent, {
    follow: true,
    writeDelayMs: ROUND_TRIP_MS,
    readDelayMs: ROUND_TRIP_MS,
    reads,
    ...options,
  });
  vi.stubGlobal("fetch", api);
  const view = await mountEditor(draft);
  last = { settle: () => view.settle(), idle: () => view.idle() };
  // The harness's DOM answers a miss with `undefined`; the page's with null.
  const row = (blockId: string) =>
    (view.root.querySelector(`[data-block-id="${blockId}"]`) as
      HTMLElement | null | undefined) ?? null;
  const editors = () =>
    [...view.root.querySelectorAll("[data-block-editor]")] as HTMLElement[];
  /** The block whose row holds the editor. */
  const editing = () =>
    editors()[0]?.closest("[data-block-id]")?.getAttribute("data-block-id") ??
    null;
  const commands = (name: string) =>
    sent.filter((command) => command.body["command"] === name);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  /** Opens a block from reading by its keyboard path, the caret at its end:
   * keyboard focus reaches the row, which focuses it, and Enter edits it.
   * CA_0046_001 */
  const open = async (blockId: string) => {
    await view.userEvent(
      `[data-block-id="${blockId}"] [data-block-reading]`,
      "focus",
    );
    await view.userEvent(
      `[data-block-id="${blockId}"] [data-block-reading]`,
      "keydown",
      { key: "Enter" },
    );
    await waitFor(() => editing() === blockId);
  };
  /** Types past the end of the active block: the browser's edit, read back
   * as it is after a keystroke. The caret stays where it was. */
  const typeTo = async (text: string) => {
    const element = editors()[0];
    if (element === undefined) throw new Error("no editor");
    element.textContent = text;
    await view.userEvent(element, "input");
  };
  const press = (key: string) =>
    view.userEvent("[data-block-editor]", "keydown", { key });
  // The harness's own wait compares a miss with null, which its DOM answers
  // with `undefined`; a read that takes time is waited for here.
  await waitFor(() => row("blk-c") !== null);
  /**
   * Counts the editors on the page after every render until `done`, flushing
   * the renders as the page would. A handover that idled the editor before
   * reading shows a zero here for as long as the read took.
   */
  const sample = async (done: () => boolean) => {
    const counts: number[] = [];
    const seen: HTMLElement[] = [];
    for (let tick = 0; tick < 400; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      await view.userEvent(view.root, "harnessSettle");
      const now = editors();
      counts.push(now.length);
      for (const element of now)
        if (!seen.includes(element)) seen.push(element);
      if (done()) return Object.assign(counts, { seen });
    }
    throw new Error("sampled, and it did not finish");
  };
  /** What the graph holds now, read as the editor reads it. */
  const graph = async () =>
    (
      (await (await api("/api/x/documents/d/doc-1")).json()) as {
        result: DocumentView;
      }
    ).result;
  return {
    ...view,
    sent,
    reads,
    row,
    editors,
    editing,
    commands,
    waitFor,
    open,
    typeTo,
    press,
    sample,
    graph,
  };
};

describe("Enter splits the block on screen at once", () => {
  it("Given typing, When Enter is pressed mid-block, Then the tail is the editor before anything is answered, and the split lands under the tail's identity after the head's words", async () => {
    const view = await mount();
    await view.open("blk-b");
    await view.typeTo(`${STORM} More`);
    const untouched = [view.row("blk-a"), view.row("blk-c")];
    const readsBefore = view.reads.length;

    await view.press("Enter");
    await view.userEvent(view.root, "harnessSettle");
    // Drawn before either write has had time to answer.
    expect(view.commands("split")).toHaveLength(0);
    const tailId = view.editing();
    expect(tailId).not.toBeNull();
    expect(tailId).not.toBe("blk-b");
    expect(view.editors()[0]?.textContent).toBe(" More");
    expect(
      view.row("blk-b")?.querySelector("[data-block-reading]")?.textContent,
    ).toBe(STORM);
    expect(view.record.selection).toBe(tailId);
    const order = [...view.root.querySelectorAll("[data-block-id]")].map(
      (row) => row.getAttribute("data-block-id"),
    );
    expect(order).toEqual(["blk-a", "blk-b", tailId, "blk-c"]);

    // An editor on the page after every render, the tail's, until both land.
    let landedAt = Number.POSITIVE_INFINITY;
    const counts = await view.sample(() => {
      if (
        view.commands("split").length === 1 &&
        landedAt === Number.POSITIVE_INFINITY
      )
        landedAt = Date.now();
      return Date.now() > landedAt + 3 * ROUND_TRIP_MS;
    });
    expect(counts.every((count) => count === 1)).toBe(true);
    expect(view.editing()).toBe(tailId);

    // The head's words first, then the split at the caret, naming the tail.
    const [revise] = view.commands("revise");
    const [split] = view.commands("split");
    expect(revise?.body).toMatchObject({
      blockId: "blk-b",
      baseRevisionId: "rev-b",
      runs: [{ text: `${STORM} More` }],
    });
    expect(split?.body).toMatchObject({
      blockId: "blk-b",
      at: STORM.length,
      tailBlockId: tailId,
    });
    expect(split?.body["baseRevisionId"]).not.toBe("rev-b");
    // No read of the document for the whole gesture, and the rows it did not
    // change are the same nodes.
    expect(view.reads.length).toBe(readsBefore);
    const held = await view.graph();
    expect(held.blocks.map((block) => block.blockId)).toEqual([
      "blk-a",
      "blk-b",
      tailId,
      "blk-c",
    ]);
    expect(view.row("blk-a")).toBe(untouched[0]);
    expect(view.row("blk-c")).toBe(untouched[1]);
  });

  it(
    "Given characters typed into the tail before its split lands, Then they reach the graph under the tail's identity",
    async () => {
      const view = await mount();
      await view.open("blk-b");
      await view.press("Enter");
      await view.userEvent(view.root, "harnessSettle");
      const tailId = view.editing() ?? "";
      await view.typeTo("Typed on");
      await view.waitFor(() =>
        view
          .commands("revise")
          .some((command) => command.body["blockId"] === tailId),
      );
      await new Promise((resolve) => setTimeout(resolve, 3 * ROUND_TRIP_MS));
      const held = await view.graph();
      const tail = held.blocks.find((block) => block.blockId === tailId);
      expect(tail?.kind === "text" && tail.runs).toEqual([
        { text: "Typed on" },
      ]);
      // Based on the revision the split answered, never on the pending one.
      const save = view
        .commands("revise")
        .find((command) => command.body["blockId"] === tailId);
      expect(save?.body["baseRevisionId"]).toMatch(/^rev-next-/u);
    },
    SAVE_PAUSE_MS + 5000,
  );

  it("Given two quick Enters, Then three blocks stand in order, on screen at once and in the graph after", async () => {
    const view = await mount();
    await view.open("blk-c");
    await view.typeTo("Closing. One");
    await view.press("Enter");
    await view.userEvent(view.root, "harnessSettle");
    const first = view.editing() ?? "";
    await view.press("Enter");
    // Drawn at once: before the second split is even sent, whatever renders
    // the counts' visible task adds after the first one. DO_0001_003
    await view.waitFor(() => view.editing() !== first);
    expect(view.commands("split").length).toBeLessThan(2);
    const second = view.editing() ?? "";
    expect(new Set(["blk-c", first, second]).size).toBe(3);
    const drawn = [...view.root.querySelectorAll("[data-block-id]")].map(
      (row) => row.getAttribute("data-block-id"),
    );
    expect(drawn).toEqual(["blk-a", "blk-b", "blk-c", first, second]);

    await view.waitFor(() => view.commands("split").length === 2);
    await new Promise((resolve) => setTimeout(resolve, 3 * ROUND_TRIP_MS));
    const held = await view.graph();
    expect(held.blocks.map((block) => block.blockId)).toEqual([
      "blk-a",
      "blk-b",
      "blk-c",
      first,
      second,
    ]);
    const texts = held.blocks.map((block) =>
      block.kind === "text" ? block.runs.map((run) => run.text).join("") : "",
    );
    expect(texts.slice(2)).toEqual(["Closing.", "", " One"]);
    // The second split is sent only after the first answered, from the head
    // the first created.
    const [, later] = view.commands("split");
    expect(later?.body).toMatchObject({
      blockId: first,
      at: 0,
      tailBlockId: second,
    });
    expect(view.editing()).toBe(second);
  });

  it(
    "Given a split the graph refuses, Then everything typed folds back into the head at the split point, the refusal is named on it, and nothing more is written",
    async () => {
      const view = await mount({ refuseSplits: true });
      await view.open("blk-b");
      await view.typeTo(`${STORM} More`);
      await view.press("Enter");
      await view.userEvent(view.root, "harnessSettle");
      const tailId = view.editing() ?? "";
      await view.typeTo(" More, and more");

      await view.waitFor(() => view.editing() === "blk-b");
      expect(view.row(tailId)).toBeNull();
      expect(view.editors()[0]?.textContent).toBe(`${STORM} More, and more`);
      expect(
        view.root.querySelector('[data-block-failure="blk-b"]')?.textContent,
      ).toContain("changed somewhere else");
      const written = view.sent.length;
      // Longer than the pause the tail's typing started: it is not the head's
      // to finish.
      await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 300));
      await view.userEvent(view.root, "harnessSettle");
      expect(view.sent.length).toBe(written);
      const held = await view.graph();
      expect(held.blocks.map((block) => block.blockId)).toEqual([
        "blk-a",
        "blk-b",
        "blk-c",
      ]);
    },
    SAVE_PAUSE_MS + 5000,
  );
});

describe("switching the edited block keeps an editor on the page", () => {
  it("Given typing in one block, When another block is opened, Then every render holds one editor, the document is read once, and the third row is untouched", async () => {
    const view = await mount();
    await view.open("blk-a");
    await view.typeTo("Opening, typed.");
    const middle = view.row("blk-b");
    const outgoing = view.editors()[0];
    const readsBefore = view.reads.length;
    await view.userEvent(
      '[data-block-id="blk-c"] [data-block-reading]',
      "keydown",
      { key: "Enter" },
    );
    const counts = await view.sample(() => view.editing() === "blk-c");
    expect(counts.every((count) => count === 1)).toBe(true);
    // The outgoing editor, then the incoming one, and no third: the read
    // that carried the outgoing block's own save did not remount it.
    expect(counts.seen).toHaveLength(2);
    expect(counts.seen[0]).toBe(outgoing);
    expect(view.commands("revise")[0]?.body).toMatchObject({
      blockId: "blk-a",
      runs: [{ text: "Opening, typed." }],
    });
    expect(view.reads.length).toBe(readsBefore + 1);
    expect(view.row("blk-b")).toBe(middle);
  });

  it(
    "Given a save the pause sent still on its way, When the block is left, Then the leave waits for the answer and writes the block once",
    async () => {
      // Found live in the BO_0248 walk-through: a pause save and the save a
      // leave flushes overlapped, the second carried the same base, and the
      // kernel's per-node floor refused it as written too frequently.
      const view = await mount({ writeDelayMs: 6 * ROUND_TRIP_MS });
      await view.open("blk-a");
      await view.typeTo("Opening, typed.");
      await view.waitFor(() => view.commands("revise").length === 1);
      await view.userEvent(
        '[data-block-id="blk-c"] [data-block-reading]',
        "keydown",
        { key: "Enter" },
      );
      await view.waitFor(() => view.editing() === "blk-c");
      await new Promise((resolve) => setTimeout(resolve, 8 * ROUND_TRIP_MS));
      await view.userEvent(view.root, "harnessSettle");
      const saves = view
        .commands("revise")
        .filter((command) => command.body["blockId"] === "blk-a");
      expect(saves).toHaveLength(1);
      const held = await view.graph();
      const opening = held.blocks.find((block) => block.blockId === "blk-a");
      expect(opening?.kind === "text" && opening.runs).toEqual([
        { text: "Opening, typed." },
      ]);
    },
    SAVE_PAUSE_MS + 5000,
  );

  it("Given the arrow key at a block's end, Then the next block takes the editor with no render between holding none", async () => {
    const view = await mount();
    await view.open("blk-a");
    await view.press("ArrowRight");
    const counts = await view.sample(() => view.editing() === "blk-b");
    expect(counts.every((count) => count === 1)).toBe(true);
  });

  it("Given Backspace at a block's start, Then the merge hands the editor to the block above with no render between holding none", async () => {
    const view = await mount();
    await view.open("blk-a");
    await view.press("ArrowRight");
    await view.waitFor(() => view.editing() === "blk-b");
    const last = view.row("blk-c");
    await view.press("Backspace");
    const counts = await view.sample(
      () => view.editing() === "blk-a" && view.row("blk-b") === null,
    );
    expect(counts.every((count) => count === 1)).toBe(true);
    expect(view.editors()[0]?.textContent).toBe(`Opening.${STORM}`);
    expect(view.row("blk-c")).toBe(last);
  });

  it(
    "Given a block's own save while it stays open, Then its editor is the same element after the save",
    async () => {
      const view = await mount();
      await view.open("blk-b");
      const element = view.editors()[0];
      await view.typeTo(`${STORM} Saved.`);
      await view.waitFor(() => view.commands("revise").length === 1);
      // A move re-reads the document, which now holds the save's revision.
      await new Promise((resolve) => setTimeout(resolve, 3 * ROUND_TRIP_MS));
      await view.userEvent("[data-block-up]", "click");
      await view.waitFor(() => view.commands("move").length === 1);
      await view.waitFor(() => view.editing() === "blk-b");
      expect(view.editors()[0]).toBe(element);
    },
    SAVE_PAUSE_MS + 5000,
  );
});

describe("a touch on another block's words while one is being edited", () => {
  /** A press as a phone sends it: the pointer's down, then the mouse
   * compatibility event whose default is to move the focus. */
  const press = (target: Element, pointerType: string) => {
    const page = target.ownerDocument;
    const pointer = page.createEvent("Event");
    pointer.initEvent("pointerdown", true, true);
    Object.defineProperty(pointer, "pointerType", { value: pointerType });
    target.dispatchEvent(pointer);
    const down = page.createEvent("Event");
    down.initEvent("mousedown", true, true);
    target.dispatchEvent(down);
    return down.defaultPrevented;
  };

  it("Given a block being edited, Then a touch on another block's words does not take the focus, and a mouse press or a touch with nothing open does", async () => {
    const view = await mount();
    const words = () =>
      view.row("blk-c")?.querySelector("[data-block-reading]") as Element;
    // `Element`, which the listener tests its targets against and the
    // harness does not install globally: an element is what it answers to.
    vi.stubGlobal("Element", {
      [Symbol.hasInstance]: (value: unknown) =>
        (value as { nodeType?: number } | null)?.nodeType === 1,
    });
    expect(press(words(), "touch")).toBe(false);
    await view.open("blk-a");
    expect(press(words(), "touch")).toBe(true);
    expect(press(words(), "mouse")).toBe(false);
    // The editor's own words and the bar are not another block's.
    expect(press(view.editors()[0] as Element, "touch")).toBe(false);
  });
});
