import { describe, expect, it } from "vitest";

import { newBlockId } from "./block-id";
import { landingOffset, linePlace } from "./lines";

/** A block's lines by its line breaks, where nothing is measured. DO_0003_002 */
describe("where a caret stands among a block's lines", () => {
  const text = "One line\nthe middle one\nlast";

  it("Given a caret on the first, a middle and the last line, Then only the first leaves up and only the last leaves down", () => {
    expect(linePlace(text, 3)).toEqual({ first: true, last: false, column: 3 });
    expect(linePlace(text, 13)).toEqual({ first: false, last: false, column: 4 });
    expect(linePlace(text, 26)).toEqual({ first: false, last: true, column: 2 });
    expect(linePlace("Single", 2)).toEqual({ first: true, last: true, column: 2 });
  });

  it("Given a caret right after a line break, Then it stands at the start of the next line", () => {
    expect(linePlace(text, 9)).toEqual({ first: false, last: false, column: 0 });
    expect(linePlace("Ends with\n", 10)).toEqual({ first: false, last: true, column: 0 });
  });

  it("Given a caret arriving, Then it lands on the nearest line as many characters in, or at that line's end", () => {
    expect(landingOffset(text, 3, 1)).toBe(3);
    expect(landingOffset(text, 20, 1)).toBe(8);
    expect(landingOffset(text, 2, -1)).toBe(26);
    expect(landingOffset(text, 20, -1)).toBe(28);
    expect(landingOffset("Short", 9, -1)).toBe(5);
    expect(landingOffset("", 4, 1)).toBe(0);
  });
});

/** A split's tail named on any origin. DO_0003_001 */
describe("a new block's identity", () => {
  it("Given no crypto.randomUUID, as on a page served over plain HTTP, Then a version 4 UUID is minted all the same", () => {
    const held = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 50 }, () => newBlockId()));
      expect(ids.size).toBe(50);
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
      }
    } finally {
      if (held === undefined) delete (crypto as { randomUUID?: unknown }).randomUUID;
      else Object.defineProperty(crypto, "randomUUID", held);
    }
  });
});
