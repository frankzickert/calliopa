import { describe, expect, it } from "vitest";

import { numberCodeLines, placeCodeLines, toBlock, type BlockView } from "./assemble";
import { blockContentFor } from "./documents";
import { validateCode, validateOutput } from "./vocabulary";

/**
 * Code and its output in a document (`BO_0289_018`): what a code block stores,
 * what the validators refuse before a write, and what the assembler answers of
 * a code block and of the output the kernel staged — the items in order, the
 * pictures and the files by the objects the blob route takes, never the bytes.
 */
const reference = (hash: string, mediaType: string, filename: string) =>
  ({ _kind: "blob", hash: `sha256:${hash.repeat(64)}`, mediaType, size: 12, filename }) as const;

describe("what a code block stores", () => {
  it("writes its source and its language, and leaves an empty language out", () => {
    expect(blockContentFor({ kind: "sourcecode", source: "x = 41", language: " python " }, "a0")).toEqual({ order: "a0", source: "x = 41", language: "python" });
    expect(blockContentFor({ kind: "sourcecode", source: "", language: "" }, "a1")).toEqual({ order: "a1", source: "" });
  });

  it("guesses the language once, where the block is made, and only when the guess is clear (BO_0296_017)", () => {
    const python = "import os\n\ndef main():\n    for name in os.listdir('.'):\n        print(name)\n";
    expect(blockContentFor({ kind: "sourcecode", source: python }, "a2")).toEqual({ order: "a2", source: python, language: "python" });
    // A word given is kept as given, never second-guessed.
    expect(blockContentFor({ kind: "sourcecode", source: python, language: "text" }, "a3")).toEqual({ order: "a3", source: python, language: "text" });
    // Nothing clear, nothing guessed: the field stays empty.
    expect(blockContentFor({ kind: "sourcecode", source: "x = 41" }, "a4")).toEqual({ order: "a4", source: "x = 41" });
  });

  it("carries a listing's caption as words and its ask as a boolean, and never a number (BO_0303_007)", () => {
    expect(validateCode({ order: "a0", source: "1", caption: "The first.", numbered: true })).toBeNull();
    expect(validateCode({ order: "a0", source: "1", caption: 3 })).toMatch(/A code block's caption is words/u);
    expect(validateCode({ order: "a0", source: "1", numbered: "yes" })).toMatch(/A code block's numbered is true or false/u);
    expect(validateCode({ order: "a0", source: "1", number: 2 })).toMatch(/never stored/u);
  });

  it("carries whether it continues its numbering only as a boolean (BO_0302_004)", () => {
    expect(validateCode({ order: "a0", source: "1", continues: true })).toBeNull();
    expect(validateCode({ order: "a0", source: "1", continues: "yes" })).toMatch(/continues is true or false/u);
  });

  it("is refused without a source as text, with runs, or with a language that is not a word", () => {
    expect(validateCode({ order: "a0", source: "1" })).toBeNull();
    expect(validateCode({ order: "a0" })).toMatch(/source is the code itself/u);
    expect(validateCode({ order: "a0", source: "1", runs: [] })).toMatch(/not runs/u);
    expect(validateCode({ order: "a0", source: "1", language: 3 })).toMatch(/language is a word/u);
  });
});

describe("what an output block must be", () => {
  it("carries items, an outcome and the block it ran, with references for what it shows", () => {
    expect(validateOutput({ order: "b0", items: [], outcome: "ok", of: "blk-1" })).toBeNull();
    expect(validateOutput({ order: "b0", outcome: "ok", of: "blk-1" })).toMatch(/items/u);
    expect(validateOutput({ order: "b0", items: [], of: "blk-1" })).toMatch(/outcome/u);
    expect(validateOutput({ order: "b0", items: [], outcome: "ok" })).toMatch(/names the code block/u);
    expect(validateOutput({ order: "b0", items: [], outcome: "ok", of: "blk-1", files: [{ hash: "x" }] })).toMatch(/blob references/u);
  });
});

describe("what the assembler answers", () => {
  const node = (id: string, type: string, content: Record<string, unknown>) => ({
    id: `node:${id}`,
    revision: { id: `rev-${id}`, content: { _type: type, ...content }, status: "established" },
  });

  it("answers a code block's source and language", () => {
    const block = toBlock(node("blk-c", "sourcecode", { order: "a", source: "print(1)", language: "python" }) as never, "c-1");
    expect(block).toMatchObject({ kind: "sourcecode", source: "print(1)", language: "python", blockId: "blk-c" });
    const bare = toBlock(node("blk-d", "sourcecode", { order: "b", source: "" }) as never, "c-2");
    expect(bare).toMatchObject({ kind: "sourcecode", source: "" });
    expect("language" in bare).toBe(false);
  });

  it("colours a code block as it reads it, and answers no markup where there is no language to colour by (BO_0296_014)", () => {
    const coloured = toBlock(node("blk-c", "sourcecode", { order: "a", source: "def f(x):\n    return x  # one\n", language: "python" }) as never, "c-1");
    expect(coloured.kind).toBe("sourcecode");
    if (coloured.kind !== "sourcecode") return;
    expect(coloured.markup).toContain('<span class="hljs-keyword">def</span>');
    expect(coloured.markup).toContain('<span class="hljs-comment"># one</span>');
    // The markup is the source character for character once its elements are stripped.
    expect((coloured.markup as string).replace(/<[^>]+>/gu, "")).toBe("def f(x):\n    return x  # one\n");
    const unknown = toBlock(node("blk-u", "sourcecode", { order: "b", source: "x = 1", language: "klingon" }) as never, "c-2");
    expect("markup" in unknown).toBe(false);
    const unnamed = toBlock(node("blk-n", "sourcecode", { order: "c", source: "x = 1" }) as never, "c-3");
    expect("markup" in unnamed).toBe(false);
    // Code that does not compile is coloured as far as the grammar reaches, never refused.
    const broken = toBlock(node("blk-b", "sourcecode", { order: "d", source: "def broken(:\n    return }\n", language: "python" }) as never, "c-4");
    expect(broken.kind === "sourcecode" && broken.markup).toContain('<span class="hljs-keyword">def</span>');
  });

  it("answers an output's items in order with its pictures and files as objects", () => {
    const block = toBlock(
      node("blk-o", "output", {
        order: "c",
        of: "blk-c",
        outcome: "error",
        elapsed: 0.5,
        executionCount: 3,
        items: [
          { kind: "stream", name: "stdout", text: "42\n" },
          { kind: "display", data: { "image/png": { picture: 0 }, "text/plain": "<Figure>" } },
          { kind: "result", data: { "text/plain": "42", "text/html": "<b>42</b>" }, executionCount: 3 },
          { kind: "error", name: "ValueError", value: "bad", traceback: ["line 1", 2] },
          { kind: "cut", reason: "output cap" },
          { kind: "nonsense" },
        ],
        pictures: [reference("a", "image/png", "figure-1.png")],
        files: [reference("b", "text/csv", "out.csv"), { hash: "not a reference" }],
      }) as never,
      "c-3",
    );
    expect(block.kind).toBe("output");
    if (block.kind !== "output") return;
    expect(block.of).toBe("blk-c");
    expect(block.outcome).toBe("error");
    expect(block.elapsed).toBe(0.5);
    expect(block.items).toEqual([
      { kind: "stream", name: "stdout", text: "42\n" },
      { kind: "display", text: "<Figure>", picture: 0 },
      { kind: "result", text: "42", html: "<b>42</b>", executionCount: 3 },
      { kind: "error", name: "ValueError", value: "bad", traceback: ["line 1"] },
      { kind: "cut", reason: "output cap" },
    ]);
    expect(block.pictures).toEqual([{ objectId: "a".repeat(64), filename: "figure-1.png", mediaType: "image/png", size: 12 }]);
    expect(block.files).toEqual([{ objectId: "b".repeat(64), filename: "out.csv", mediaType: "text/csv", size: 12 }]);
    expect(JSON.stringify(block)).not.toContain("sha256");
  });

  it("reports an output without items as unsupported rather than dropping it", () => {
    expect(toBlock(node("blk-x", "output", { order: "d", outcome: "ok" }) as never, "c-4").kind).toBe("unsupported");
  });
});

/**
 * Where each code block's numbering starts (`BO_0302_005`): resolved in
 * reading order from the `continues` flag alone, and a proposed block placed
 * among the established ones.
 */
describe("where a code block's numbering starts", () => {
  const code = (blockId: string, order: string, source: string, continues?: boolean, language?: string): BlockView => ({
    kind: "sourcecode",
    blockId,
    revisionId: `rev-${blockId}`,
    containmentId: `c-${blockId}`,
    order,
    source,
    ...(continues === undefined ? {} : { continues }),
    ...(language === undefined ? {} : { language }),
  });
  const prose = (blockId: string, order: string): BlockView => ({
    kind: "text",
    blockId,
    revisionId: `rev-${blockId}`,
    containmentId: `c-${blockId}`,
    order,
    role: "paragraph",
    standing: "keep",
    runs: [{ text: "Between." }],
  });
  const firstLines = (blocks: readonly BlockView[]) => blocks.map((block) => (block.kind === "sourcecode" ? block.firstLine : null));

  it("starts every block at one unless it continues, and a continuing block after the code block above it, whatever stands between", () => {
    expect(firstLines(numberCodeLines([code("a", "a", "x = 1\ny = 2\n"), prose("p", "b"), code("b", "c", "z = 3", true), code("c", "d", "w = 4")]))).toEqual([1, null, 3, 1]);
  });

  it("counts a chain on, and starts a continuing block with nothing above it at one", () => {
    expect(firstLines(numberCodeLines([code("a", "a", "one\ntwo", true), code("b", "b", "three", true), code("c", "c", "four\nfive", true)]))).toEqual([1, 3, 4]);
  });

  it("continues across a block in another language, since the numbers are the document's", () => {
    const blocks = numberCodeLines([code("a", "a", "SELECT 1;\n", undefined, "sql"), code("b", "b", "print(1)", true, "python")]);
    expect(firstLines(blocks)).toEqual([1, 2]);
  });

  it("stores nothing: a block removed re-numbers the ones below on the next read", () => {
    const before = numberCodeLines([code("a", "a", "one\ntwo\nthree"), code("b", "b", "four", true)]);
    expect(firstLines(before)).toEqual([1, 4]);
    expect(firstLines(numberCodeLines([code("b", "b", "four", true)]))).toEqual([1]);
  });

  it("carries the flag from the stored block and reads the document's switch as stored", () => {
    const node = (id: string, type: string, content: Record<string, unknown>) => ({
      id: `node:${id}`,
      revision: { id: `rev-${id}`, content: { _type: type, ...content }, status: "established" },
    });
    expect(toBlock(node("blk-k", "sourcecode", { order: "a", source: "x", continues: true }) as never, "c-1")).toMatchObject({ continues: true });
    expect("continues" in toBlock(node("blk-l", "sourcecode", { order: "b", source: "x" }) as never, "c-2")).toBe(false);
  });

  it("places a proposed block after the code block above its place, and at one when it does not continue or nothing stands above", () => {
    const established = numberCodeLines([code("a", "a", "one\ntwo\n"), prose("p", "c"), code("c", "e", "six", true)]);
    expect(placeCodeLines(code("n", "b", "three", true), established)).toMatchObject({ firstLine: 3 });
    expect(placeCodeLines(code("n", "d", "x", true), established)).toMatchObject({ firstLine: 3 });
    expect(placeCodeLines(code("n", "f", "x", true), established)).toMatchObject({ firstLine: 4 });
    expect(placeCodeLines(code("n", "b", "three"), established)).toMatchObject({ firstLine: 1 });
    expect(placeCodeLines(code("n", "0", "x", true), established)).toMatchObject({ firstLine: 1 });
    expect(placeCodeLines(prose("q", "b"), established)).toEqual(prose("q", "b"));
  });
});
