import { describe, expect, it } from "vitest";

import { lineCount, lineNumbersFrom, resolveFirstLines, type CountedBlock } from "./code-lines";

describe("the lines of a code block", () => {
  it("counts a line per newline-ended run, a final newline ending the last line rather than starting another", () => {
    expect(lineCount("x = 1")).toBe(1);
    expect(lineCount("x = 1\ny = 2")).toBe(2);
    expect(lineCount("x = 1\ny = 2\n")).toBe(2);
    expect(lineCount("x = 1\n\ny = 2\n")).toBe(3);
  });

  it("gives an empty source one line, and a lone newline one", () => {
    expect(lineCount("")).toBe(1);
    expect(lineCount("\n")).toBe(1);
  });

  it("numbers from where the block starts", () => {
    expect(lineNumbersFrom(1, 3)).toEqual([1, 2, 3]);
    expect(lineNumbersFrom(40, 2)).toEqual([40, 41]);
    expect(lineNumbersFrom(7, 0)).toEqual([]);
  });
});

describe("where each block's numbering starts", () => {
  const code = (blockId: string, source: string, continues?: boolean): CountedBlock => ({ blockId, kind: "sourcecode", source, ...(continues === undefined ? {} : { continues }) });
  const prose = (blockId: string): CountedBlock => ({ blockId, kind: "text" });

  it("starts at one unless a block continues, and then after the code block above it, whatever stands between", () => {
    expect(resolveFirstLines([code("a", "x\ny\n"), prose("p"), code("b", "z", true), code("c", "w")])).toEqual({ a: 1, b: 3, c: 1 });
  });

  it("counts a chain on and starts a continuing block with nothing above it at one", () => {
    expect(resolveFirstLines([code("a", "one\ntwo", true), code("b", "three", true), code("c", "four\nfive", true)])).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("re-numbers the blocks below a block as it is typed, from the count typed rather than the source read", () => {
    const blocks = [code("a", "x\ny\n"), code("b", "z", true)];
    expect(resolveFirstLines(blocks, { a: 5 })).toEqual({ a: 1, b: 6 });
    expect(resolveFirstLines(blocks, { b: 9 })).toEqual({ a: 1, b: 3 });
  });
});
