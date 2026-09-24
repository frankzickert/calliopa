import { describe, expect, it } from "vitest";

import { numberLabel, referenceLabel } from "./figure-label";

describe("the words a figure and a table are drawn with", () => {
  it("draws a reference as its block's current number", () => {
    expect(referenceLabel("figure", 3)).toBe("Figure 3");
    expect(referenceLabel("table", 2)).toBe("Table 2");
  });

  it("says a reference's block is gone rather than drawing a stale number", () => {
    expect(referenceLabel("figure", undefined)).toBe("(figure gone)");
    expect(referenceLabel("table", undefined)).toBe("(table gone)");
  });

  it("labels a numbered block before its caption", () => {
    expect(numberLabel("figure", 1)).toBe("Figure 1.");
    expect(numberLabel("table", 4)).toBe("Table 4.");
  });
});
