import { describe, expect, it } from "vitest";
import { declineNotice } from "./declines";

const refused = { outcome: "storageError", detail: "the kernel is unreachable" } as const;
const describeIt = (outcome: { outcome: string; detail?: string }) => outcome.detail ?? "";

// Retiring a selection declines its proposals together; the ones refused stay
// and one notice names them. DO_0024_001
describe("declineNotice", () => {
  it("names the one proposal that stayed by its first words, and why", () => {
    expect(declineNotice([{ item: { kind: "insert", block: { runs: [{ text: "A new closing line." }] } }, outcome: refused }], describeIt)).toBe(
      "“A new closing line.” was not declined and stayed: the kernel is unreachable",
    );
  });

  it("names several, a proposal without words by what it does, and cuts long words", () => {
    const long = "word ".repeat(20);
    expect(
      declineNotice(
        [
          { item: { kind: "remove", block: null }, outcome: refused },
          { item: { kind: "replace", block: { runs: [{ text: long }] } }, outcome: { outcome: "refused", detail: "someone else has to decline it" } as never },
        ],
        describeIt,
      ),
    ).toBe("a proposed remove and “word word word word word word word word…” were not declined and stayed.");
  });
});
