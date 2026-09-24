import { describe, expect, it } from "vitest";

import { markingName, readingName, type RowFacts } from "./row-name";

const facts = (overrides: Partial<RowFacts>): RowFacts => ({
  position: 3,
  mode: "command",
  reference: null,
  passages: [],
  standing: "keep",
  ...overrides,
});

describe("a row's accessible name", () => {
  it("Given no passages and no standing, Then the names CA_0020 gave stand", () => {
    expect(markingName(facts({}))).toBe("Mark block 3");
    expect(markingName(facts({ reference: 2 }))).toBe("Block 3, reference 2");
    expect(readingName(facts({ mode: "reading" }))).toBe("Edit block 3");
  });

  it("Given passages, Then they are said by number, and the stale ones as stale", () => {
    expect(
      markingName(
        facts({ reference: 2, passages: [{ number: 4, stale: false }] }),
      ),
    ).toBe("Block 3, reference 2, passage 4");
    expect(
      markingName(
        facts({
          passages: [
            { number: 4, stale: false },
            { number: 5, stale: false },
            { number: 6, stale: true },
          ],
        }),
      ),
    ).toBe("Mark block 3, passages 4 and 5, passage 6 stale");
  });

  it("Given a standing, Then it is said in its word, in both modes, and keep says nothing", () => {
    expect(markingName(facts({ standing: "fixate" }))).toBe(
      "Mark block 3, fixated",
    );
    expect(readingName(facts({ mode: "reading", standing: "discarded" }))).toBe(
      "Edit block 3, discarded",
    );
    // Keep is where a block stands unless someone says otherwise, so the row
    // says nothing of it. BO_0272_006
    expect(readingName(facts({ mode: "reading", standing: "keep" }))).toBe(
      "Edit block 3",
    );
  });
});
