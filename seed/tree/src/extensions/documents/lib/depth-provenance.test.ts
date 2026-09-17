import { describe, expect, it } from "vitest";

import { provenanceWords } from "./depth";

/** A relation's provenance in words, each part only where it holds. BO_0247_006 */
describe("provenanceWords", () => {
  it("says system-inferred, system-drafted, confirmed and later edited, in that order", () => {
    expect(provenanceWords({ origin: "inferred", draftedBy: "agent:hermes", editedBy: ["ben"], confirmedBy: "alice" })).toBe(
      "system-inferred · system-drafted reason · confirmed by alice · later edited by ben",
    );
  });

  it("says a person's own relation is declared with their reason, and nothing more", () => {
    expect(provenanceWords({ origin: "declared", draftedBy: "alice", editedBy: [], confirmedBy: null })).toBe("declared · reason by alice");
  });

  it("names a derived relation and several editors", () => {
    expect(provenanceWords({ origin: "derived", draftedBy: "agent:hermes", editedBy: ["alice", "ben"], confirmedBy: "alice" })).toBe(
      "derived · system-drafted reason · confirmed by alice · later edited by alice, ben",
    );
  });
});
