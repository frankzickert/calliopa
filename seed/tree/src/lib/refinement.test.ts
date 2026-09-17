import { describe, expect, it } from "vitest";

import { parseRefinement, refinementWords } from "./refinement";

/** The settings row's words and the route's parsing. BO_0245_011 */
describe("refinement settings", () => {
  it("parses a switch with a whole number of seconds and refuses anything else", () => {
    expect(parseRefinement({ enabled: true, settleSeconds: 30 })).toEqual({ enabled: true, settleSeconds: 30 });
    expect(parseRefinement({ enabled: false, settleSeconds: 0 })).toEqual({ enabled: false, settleSeconds: 0 });
    expect(parseRefinement({ enabled: "yes", settleSeconds: 30 })).toBeNull();
    expect(parseRefinement({ enabled: true, settleSeconds: -1 })).toBeNull();
    expect(parseRefinement({ enabled: true, settleSeconds: 1.5 })).toBeNull();
    expect(parseRefinement(null)).toBeNull();
  });

  it("says on with the settle time, off, or that it waits for a runtime", () => {
    expect(refinementWords({ enabled: true, settleSeconds: 30 }, true)).toBe("Refinement: on, after 30 s of quiet.");
    expect(refinementWords({ enabled: true, settleSeconds: 0 }, true)).toBe("Refinement: on, at once after a change.");
    expect(refinementWords({ enabled: false, settleSeconds: 30 }, true)).toBe("Refinement: off.");
    expect(refinementWords({ enabled: true, settleSeconds: 30 }, false)).toBe(
      "Refinement: on, after 30 s of quiet — it waits until a runtime is signed in.",
    );
  });
});
