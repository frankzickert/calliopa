import { describe, expect, it } from "vitest";

import { tracebackSegments } from "./traceback";

const TRACEBACK = [
  "Traceback (most recent call last):",
  '  File "/tmp/cell.py", line 3, in <module>',
  "    main()",
  '  File "/tmp/cell.py", line 2, in main',
  "    return 1 / 0",
  "           ~~^~~",
  "ZeroDivisionError: division by zero",
].join("\n");

describe("the parts of a traceback", () => {
  it("names the exception, each frame's file, line and function, and the markers, keeping every character", () => {
    const segments = tracebackSegments(TRACEBACK);
    expect(segments.map((segment) => segment.text).join("")).toBe(TRACEBACK);
    expect(segments.filter((segment) => segment.kind !== "text")).toEqual([
      { kind: "heading", text: "Traceback (most recent call last):" },
      { kind: "file", text: '"/tmp/cell.py"' },
      { kind: "line", text: "3" },
      { kind: "frame", text: "<module>" },
      { kind: "file", text: '"/tmp/cell.py"' },
      { kind: "line", text: "2" },
      { kind: "frame", text: "main" },
      { kind: "marker", text: "           ~~^~~" },
      { kind: "exception", text: "ZeroDivisionError" },
    ]);
  });

  it("colours a one-line error's name and leaves prose alone", () => {
    expect(tracebackSegments("ValueError: bad")).toEqual([
      { kind: "exception", text: "ValueError" },
      { kind: "text", text: ": bad" },
    ]);
    expect(tracebackSegments("something went wrong\nand then more")).toEqual([{ kind: "text", text: "something went wrong\nand then more" }]);
  });
});

/** What a Jupyter kernel answers, as the dogfood instance stored it on
 * 2026-09-25 with its escapes already stripped: IPython's shape. */
const IPYTHON = [
  "---------------------------------------------------------------------------",
  "NameError                                 Traceback (most recent call last)",
  "Cell In[1], line 2\n      1 x = 11 + 4\n----> 2 asdadfa\n",
  "NameError: name 'asdadfa' is not defined",
].join("\n");

describe("IPython's shape of a traceback", () => {
  it("names the exception twice, the cell and its line, the pointed line and the rule, keeping every character", () => {
    const segments = tracebackSegments(IPYTHON);
    expect(segments.map((segment) => segment.text).join("")).toBe(IPYTHON);
    expect(segments.filter((segment) => segment.kind !== "text")).toEqual([
      { kind: "marker", text: "---------------------------------------------------------------------------" },
      { kind: "exception", text: "NameError" },
      { kind: "heading", text: "                                 Traceback (most recent call last)" },
      { kind: "file", text: "In[1]" },
      { kind: "line", text: "2" },
      { kind: "marker", text: "----> " },
      { kind: "line", text: "2" },
      { kind: "exception", text: "NameError" },
    ]);
  });

  it("names a file frame of IPython's form with its function", () => {
    expect(tracebackSegments("File ~/work/model.py:12, in fit(x, y)")).toEqual([
      { kind: "text", text: "File " },
      { kind: "file", text: "~/work/model.py" },
      { kind: "text", text: ":" },
      { kind: "line", text: "12" },
      { kind: "text", text: ", in " },
      { kind: "frame", text: "fit(x, y)" },
    ]);
  });
});
