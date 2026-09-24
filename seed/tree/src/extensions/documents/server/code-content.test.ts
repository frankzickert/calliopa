import { describe, expect, it } from "vitest";

import { toBlock } from "./assemble";
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
