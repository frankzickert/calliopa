import { describe, expect, it } from "vitest";

import { KIND_WORDS, REVERSE_KIND_WORDS } from "./depth";

/**
 * A relation is read from both ends now that a block's depth groups by
 * direction, so every kind needs words for the far end as well as its own
 * (`BO_0258_024`). The rule the old rendering broke: the reverse reading is
 * written out, never built by wrapping the forward words in *Is … by*, which
 * made `dependsOn` read *Is depends on by*.
 */

describe("a relation reads as English from either end (BO_0258_024)", () => {
  it("gives every declared kind words for its far end", () => {
    expect(Object.keys(REVERSE_KIND_WORDS).sort()).toEqual(Object.keys(KIND_WORDS).sort());
  });

  it("never builds the reverse by wrapping the forward words", () => {
    for (const [kind, forward] of Object.entries(KIND_WORDS)) {
      expect(REVERSE_KIND_WORDS[kind]).not.toBe(`Is ${forward.toLowerCase()} by`);
    }
  });

  it("reads the two directions of the kinds a depth actually shows", () => {
    expect(KIND_WORDS["dependsOn"]).toBe("Depends on");
    expect(REVERSE_KIND_WORDS["dependsOn"]).toBe("Is depended on by");
    expect(KIND_WORDS["supports"]).toBe("Supports");
    expect(REVERSE_KIND_WORDS["supports"]).toBe("Is supported by");
    // Already passive one way, so the other end is the plain active verb.
    expect(KIND_WORDS["affectedBy"]).toBe("Is affected by");
    expect(REVERSE_KIND_WORDS["affectedBy"]).toBe("Affects");
  });
});
