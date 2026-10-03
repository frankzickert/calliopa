import { describe, expect, it } from "vitest";

import { firstFixed, mergeFixed } from "./fixed";

/** What several guards fix on one document, as one answer (`RO_0005_020`). */
describe("what guards fix on a document", () => {
  it("answers nothing fixed when no guard fixes anything", () => {
    expect(mergeFixed([])).toEqual({ blocks: {} });
    expect(mergeFixed([{ blocks: {} }, { blocks: {} }])).toEqual({ blocks: {} });
  });

  it("keeps the first reason given for the document, its title and each block, and every block any guard keeps", () => {
    expect(
      mergeFixed([
        { undeletable: "first", blocks: { a: "a, first" } },
        { undeletable: "second", title: "title", blocks: { a: "a, second", b: "b" } },
      ]),
    ).toEqual({ undeletable: "first", title: "title", blocks: { a: "a, first", b: "b" } });
  });

  it("names the first block of those asked that a guard keeps, with its reason, and none when none is kept", () => {
    const fixed = { blocks: { b: "b stays", c: "c stays" } };
    expect(firstFixed(fixed, ["a", "c", "b"])).toEqual({ blockId: "c", reason: "c stays" });
    expect(firstFixed(fixed, ["a", "d"])).toBeNull();
    expect(firstFixed(fixed, new Set<string>())).toBeNull();
  });
});
