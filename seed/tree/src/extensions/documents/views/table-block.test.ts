import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView, TableBlockView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A table in a document, pressed in the render harness (`BO_0287_014`): the
 * grid drawn from a block's cells with each header's type, a cell edit landing
 * as one `reviseTable` with the same id, a cell refused outside its type with
 * the cell named, a column's type changed and a misfit refused, a row and a
 * column added and removed, a pasted grid becoming a table and a pasted word
 * staying text, a table with a file behind it drawn from its preview with its
 * count and asking the blob route for nothing, and a stored type the build
 * does not know still drawn as unsupported content.
 */
const text = (blockId: string, order: string, words: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: words === "" ? [] : [{ text: words }],
});

const columns = [
  { name: "City", type: "text" as const },
  { name: "Population", type: "number" as const },
];

const table = (
  blockId: string,
  order: string,
  rest: Partial<Omit<TableBlockView, "kind" | "blockId" | "revisionId" | "containmentId" | "order">> = {},
): BlockView => ({
  kind: "table",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  columns,
  rows: [
    ["Berlin", "3755000"],
    ["Hamburg", "1892000"],
  ],
  ...rest,
});

async function mount(blocks: readonly BlockView[], documentId = "doc-1") {
  const document: DocumentView = {
    documentId,
    revisionId: "rev-doc",
    title: "Cities",
    blocks: [...blocks],
  };
  const sent: SentCommand[] = [];
  const fetched: string[] = [];
  const api = documentsApi(document, sent);
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    fetched.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return api(input, init);
  });
  const view = await mountEditor(document);
  return { view, sent, fetched };
}

type Mounted = Awaited<ReturnType<typeof mountEditor>>;

/** Sets an input's value and fires the change the editor listens for, the
 * way the harness delivers every event: through Qwik's own trigger. */
async function change(view: Mounted, element: Element | null, value: string) {
  const input = element as HTMLInputElement | HTMLSelectElement | null;
  expect(input).toBeTruthy();
  input!.value = value;
  await view.userEvent(input!, "change");
  await view.settle();
}

async function press(view: Mounted, selector: string) {
  expect(view.root.querySelector(selector)).toBeTruthy();
  await view.userEvent(selector, "click");
  await view.settle();
}

const commands = (sent: readonly SentCommand[], name: string) => sent.filter((entry) => entry.body["command"] === name).map((entry) => entry.body);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a table in a document", () => {
  it("draws the grid from the block's cells with each header's type", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), table("blk-t", "b", { caption: "German cities" })]);
    const drawn = view.root.querySelector("[data-table-block]") as HTMLElement;
    expect(drawn).toBeTruthy();
    expect(drawn.getAttribute("data-table-editable")).toBe("true");
    const headers = [...view.root.querySelectorAll("[data-table-column]")];
    expect(headers.map((header) => header.getAttribute("data-table-column-type"))).toEqual(["text", "number"]);
    expect((view.root.querySelector("[data-table-name='1']") as HTMLInputElement).value).toBe("Population");
    // Asserted by attribute: this DOM leaves `select.value` undefined (`BO_0224`).
    const chosen = [...view.root.querySelectorAll("[data-table-type='1'] option")].filter((option) => option.hasAttribute("selected"));
    expect(chosen.map((option) => option.getAttribute("value"))).toEqual(["number"]);
    expect((view.root.querySelector("[data-table-input='1:0']") as HTMLInputElement).value).toBe("Hamburg");
    expect((view.root.querySelector("[data-table-caption]") as HTMLInputElement).value).toBe("German cities");
    // In its order among the prose, on a row of its own.
    const rows = [...view.root.querySelectorAll("[data-block-id]")].map((row) => row.getAttribute("data-block-id"));
    expect(rows).toEqual(["blk-a", "blk-t"]);
    expect(view.root.querySelector("[data-block-id='blk-t']")?.getAttribute("data-block-kind")).toBe("table");
  });

  it("lands a cell edit as one reviseTable of the whole table on the same block", async () => {
    const { view, sent } = await mount([table("blk-t", "b")]);
    await change(view, view.root.querySelector("[data-table-input='1:1']"), "1900000");
    const revises = commands(sent, "reviseTable");
    expect(revises).toHaveLength(1);
    expect(revises[0]).toMatchObject({
      blockId: "blk-t",
      baseRevisionId: "rev-blk-t",
      columns,
      rows: [
        ["Berlin", "3755000"],
        ["Hamburg", "1900000"],
      ],
    });
    expect(revises[0]).not.toHaveProperty("caption");
    expect(view.root.querySelector("[data-table-failure]")).toBeFalsy();
  });

  it("refuses a cell outside its column's type with the cell named, and sends nothing", async () => {
    const { view, sent } = await mount([table("blk-t", "b")]);
    await change(view, view.root.querySelector("[data-table-input='0:1']"), "3.7 million");
    expect(commands(sent, "reviseTable")).toHaveLength(0);
    const failure = view.root.querySelector("[data-table-failure]") as HTMLElement;
    expect(failure.textContent).toBe('Row 1, column "Population": "3.7 million" is not a number in canonical form (a decimal such as 12 or -3.5).');
    expect(view.root.querySelector("[data-table-cell='0:1']")?.getAttribute("data-table-misfit")).toBe("true");
  });

  it("changes a column's type in the header, and refuses the change when a cell does not fit", async () => {
    const { view, sent } = await mount([table("blk-t", "b")]);
    await change(view, view.root.querySelector("[data-table-type='1']"), "text");
    expect(commands(sent, "reviseTable")[0]).toMatchObject({ columns: [columns[0], { name: "Population", type: "text" }] });
    // A number column that holds a city name cannot become a date.
    await change(view, view.root.querySelector("[data-table-type='0']"), "date");
    expect(commands(sent, "reviseTable")).toHaveLength(1);
    expect(view.root.querySelector("[data-table-failure]")?.textContent).toContain('column "City": "Berlin" is not an ISO 8601 date');
  });

  it("adds and removes a row and a column", async () => {
    const { view, sent } = await mount([table("blk-t", "b")]);
    await press(view, "[data-table-add-row]");
    expect(commands(sent, "reviseTable").at(-1)).toMatchObject({ rows: [["Berlin", "3755000"], ["Hamburg", "1892000"], ["", ""]] });
    await press(view, "[data-table-remove-row='0']");
    expect(commands(sent, "reviseTable").at(-1)).toMatchObject({ rows: [["Hamburg", "1892000"], ["", ""]] });
    await press(view, "[data-table-add-column]");
    expect(commands(sent, "reviseTable").at(-1)).toMatchObject({
      columns: [...columns, { name: "Column 3", type: "text" }],
      rows: [["Hamburg", "1892000", ""], ["", "", ""]],
    });
    await press(view, "[data-table-remove-column='1']");
    expect(commands(sent, "reviseTable").at(-1)).toMatchObject({
      columns: [columns[0], { name: "Column 3", type: "text" }],
      rows: [["Hamburg", ""], ["", ""]],
    });
  });

  it("draws a table with a file behind it from its preview with the count, and asks the blob route for nothing", async () => {
    const { view, fetched } = await mount([table("blk-t", "b", { file: { objectId: "a".repeat(64), rowCount: 12400 } })]);
    expect(view.root.querySelector("[data-table-count]")?.textContent).toBe("first 2 of 12400 rows");
    expect(view.root.querySelectorAll("[data-table-row]")).toHaveLength(2);
    expect(fetched.some((url) => url.includes("/api/blobs/"))).toBe(false);
  });

  it("makes a table from a grid pasted into an empty paragraph", async () => {
    const { view, sent } = await mount([text("blk-a", "a", "Opening."), text("blk-b", "b", "")]);
    await activateBlock(view, "blk-b");
    const editor = view.root.querySelector("[data-block-editor]") as HTMLElement;
    expect(editor).toBeTruthy();
    await view.userEvent(editor, "paste", { clipboardData: { getData: () => "City\tPopulation\nBerlin\t3755000\n" } });
    await view.settle();
    const inserts = commands(sent, "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      block: { kind: "table", columns, rows: [["Berlin", "3755000"]] },
      placement: { after: "blk-b" },
    });
    // The empty paragraph the grid was pasted into goes.
    expect(commands(sent, "retire").map((command) => command["blockId"])).toEqual(["blk-b"]);
    // The reads the retire starts finish before the stubbed fetch goes.
    await view.idle();
  });

  it("keeps a pasted word as text", async () => {
    // Its own document: the editor keeps its in-flight writes by tab, and a
    // second mount of the same one would wait on the first's.
    const { view, sent } = await mount([text("blk-a", "a", "Opening."), text("blk-b", "b", "")], "doc-2");
    await activateBlock(view, "blk-b");
    const editor = view.root.querySelector("[data-block-editor]") as HTMLElement;
    await view.userEvent(editor, "paste", { clipboardData: { getData: () => "Berlin" } });
    await view.settle();
    expect(commands(sent, "insert")).toHaveLength(0);
    expect(editor.textContent).toContain("Berlin");
  });

  it("says on a proposed rewrite of a table with a file behind it that accepting drops the file, and draws the proposed table read-only", async () => {
    const held = table("blk-t", "b", { file: { objectId: "a".repeat(64), rowCount: 12400 } });
    const proposals: DocumentProposals = {
      documentId: "doc-3",
      unanswered: 1,
      groups: [
        {
          groupId: "node:run-1",
          stagedBy: ["hermes"],
          proposer: { kind: "agent", agent: "hermes", executedBy: "hermes" },
          items: [
            {
              itemId: "item-1",
              groupId: "node:run-1",
              kind: "replace",
              blockId: "blk-t",
              block: { ...(table("blk-t", "b") as TableBlockView), revisionId: "rev-proposed", rows: [["Berlin", "3755000"], ["Hamburg", "1892000"], ["Munich", "1512000"]] },
            },
          ],
        },
      ],
    };
    const document: DocumentView = { documentId: "doc-3", revisionId: "rev-doc", title: "Cities", blocks: [held] };
    vi.stubGlobal("fetch", documentsApi(document, [], { proposals }));
    const view = await mountEditor(document);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-drops-file]") !== null);
    expect(view.root.querySelector("[data-proposal-drops-file]")?.textContent).toContain("drops the file behind this table");
    // The proposed table is drawn as it is, its cells read and not edited.
    const proposed = [...view.root.querySelectorAll("[data-table-block]")].find((drawn) => drawn.closest("[data-proposal-kind]") !== null);
    expect(proposed).toBeTruthy();
    expect(proposed?.getAttribute("data-table-editable")).toBeFalsy();
    expect(proposed?.querySelectorAll("[data-table-row]")).toHaveLength(3);
  });

  it("takes a .csv dropped anywhere in the tab: after the row it fell on, or at the end", async () => {
    const { view, sent } = await mount([text("blk-a", "a", "Opening."), text("blk-b", "b", "Closing.")], "doc-4");
    const file = new File(["City;Population\nBerlin;3755000\n"], "cities.csv", { type: "text/csv" });
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "drop", { dataTransfer: { files: [file] } });
    await view.settle(() => commands(sent, "insert").length === 1);
    expect(commands(sent, "insert")[0]).toMatchObject({
      block: { kind: "table", columns: [{ name: "City", type: "text" }, { name: "Population", type: "number" }], rows: [["Berlin", "3755000"]] },
      placement: { after: "blk-a" },
    });
    // Below the last block, on the view itself: at the end.
    await view.userEvent("[data-view-body]", "drop", { dataTransfer: { files: [file] } });
    await view.settle(() => commands(sent, "insert").length === 2);
    expect(commands(sent, "insert")[1]).toMatchObject({ placement: { at: "end" } });
    // A file of another kind is refused in words and inserts nothing.
    await view.userEvent("[data-view-body]", "drop", { dataTransfer: { files: [new File(["x"], "sheet.xlsx")] } });
    await view.settle();
    expect(commands(sent, "insert")).toHaveLength(2);
    expect(view.root.textContent).toContain("sheet.xlsx is not a .csv or .tsv file");
    await view.idle();
  });

  it("still draws a stored type the build does not know as unsupported content", async () => {
    const { view } = await mount([
      { kind: "unsupported", blockId: "blk-u", revisionId: "rev-u", containmentId: "c-u", order: "a", semanticType: "chart", content: {} },
      table("blk-t", "b"),
    ]);
    expect(view.root.querySelector("[data-block-unsupported='chart']")).toBeTruthy();
    expect(view.root.querySelector("[data-table-block]")).toBeTruthy();
  });
});
