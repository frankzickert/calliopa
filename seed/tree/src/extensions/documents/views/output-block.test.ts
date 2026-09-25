import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * An output in a document (`BO_0289_018`): drawn as the execution streamed
 * it — the streams as text, an error with its traceback stripped of colour
 * escapes, a picture from the blob route, HTML as text and never rendered, a
 * cut in words, the outcome and the time, and every written file as a name
 * that downloads from the blob route.
 */
const output = (blockId: string, order: string): BlockView => ({
  kind: "output",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  of: "blk-code",
  outcome: "error",
  elapsed: 1.5,
  executionCount: 4,
  items: [
    { kind: "stream", name: "stdout", text: "42\n" },
    { kind: "display", text: "<Figure>", picture: 0 },
    { kind: "result", text: "42", html: "<b>bold</b>", executionCount: 4 },
    { kind: "result", html: "<script>alert(1)</script>" },
    { kind: "error", name: "ValueError", value: "bad", traceback: ["\u001b[31mValueError\u001b[39m: bad"] },
    { kind: "cut", reason: "output cap" },
  ],
  pictures: [{ objectId: "a".repeat(64), filename: "figure-1.png", mediaType: "image/png", size: 70 }],
  files: [{ objectId: "b".repeat(64), filename: "out.csv", mediaType: "text/csv", size: 12 }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an output in a document", () => {
  it("draws each item as it streamed, the picture and the file from the blob route", async () => {
    const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notebook", blocks: [output("blk-o", "b")] };
    vi.stubGlobal("fetch", documentsApi(document, []));
    const view = await mountEditor(document);
    const block = view.root.querySelector("[data-output-block='blk-o']") as HTMLElement;
    expect(block).toBeTruthy();
    expect(block.getAttribute("data-output-of")).toBe("blk-code");
    expect(block.getAttribute("data-output-outcome")).toBe("error");
    expect(block.querySelector(".output-block__outcome")?.textContent).toContain("ended with an error in 1.50 s");
    expect(block.querySelector("[data-output-stream='stdout']")?.textContent).toBe("42\n");
    const picture = block.querySelector("[data-output-picture]") as HTMLImageElement;
    expect(picture.getAttribute("src")).toBe(`/api/blobs/${"a".repeat(64)}`);
    expect(block.querySelectorAll("[data-output-text]")[0]?.textContent).toBe("42");
    // HTML is shown as text, never rendered: the code that made it may be a run's.
    expect(block.querySelector("[data-output-html]")?.textContent).toBe("<script>alert(1)</script>");
    expect(block.querySelector("script")).toBeFalsy();
    expect(block.querySelector("[data-output-error='ValueError']")?.textContent).toBe("ValueError: bad");
    expect(block.querySelector("[data-output-cut='output cap']")?.textContent).toContain("output cap");
    const file = block.querySelector("[data-output-file='out.csv']") as HTMLAnchorElement;
    expect(file.getAttribute("href")).toBe(`/api/blobs/${"b".repeat(64)}`);
    expect(file.getAttribute("download")).toBe("out.csv");
  });
});

/** An error's traceback in colour (`BO_0296_019`): the exception's name,
 * each frame's file, line and function, with the escapes stripped first and
 * every character kept. */
describe("an error in colour", () => {
  const TRACEBACK = [
    "\u001b[31mTraceback (most recent call last):\u001b[39m",
    '  File "/tmp/cell.py", line 2, in <module>',
    "    1 / 0",
    "\u001b[1mZeroDivisionError\u001b[0m: division by zero",
  ];
  const errored = (): DocumentView => ({
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Notebook",
    blocks: [
      {
        kind: "sourcecode",
        blockId: "blk-c",
        revisionId: "rev-c",
        containmentId: "c-c",
        order: "a",
        source: "1 / 0",
        language: "python",
      },
      {
        kind: "output",
        blockId: "blk-e",
        revisionId: "rev-e",
        containmentId: "c-e",
        order: "b",
        of: "blk-c",
        outcome: "error",
        items: [{ kind: "error", name: "ZeroDivisionError", value: "division by zero", traceback: TRACEBACK }],
        pictures: [],
        files: [],
      },
    ],
  });

  it("colours the exception, the file, the line and the frame, and reads as the plain traceback", async () => {
    const document = errored();
    vi.stubGlobal("fetch", documentsApi(document, []));
    const view = await mountEditor(document);
    const error = view.root.querySelector("[data-output-error='ZeroDivisionError']") as HTMLElement;
    expect(error.textContent).toBe(
      ["Traceback (most recent call last):", '  File "/tmp/cell.py", line 2, in <module>', "    1 / 0", "ZeroDivisionError: division by zero"].join("\n"),
    );
    const tokens = Array.from(error.querySelectorAll("[data-error-token]")).map((token) => [token.getAttribute("data-error-token"), token.textContent]);
    expect(tokens).toEqual([
      ["heading", "Traceback (most recent call last):"],
      ["file", '"/tmp/cell.py"'],
      ["line", "2"],
      ["frame", "<module>"],
      ["exception", "ZeroDivisionError"],
    ]);
    expect(error.textContent).not.toContain("\u001b");
  });
});
