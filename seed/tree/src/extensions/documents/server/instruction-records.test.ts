import { describe, expect, it } from "vitest";
import { instructionRecordsStatement } from "./documents";

/**
 * Profiles become instructions (`calliopa-bootstrap`'s `BO_0338`): every
 * established document still carrying `record: profile` takes `record:
 * instruction`, and one still titled as an unnamed profile is titled as an
 * unnamed instruction; a candidate, another record and a document already
 * moved are left alone, and nothing left answers an empty script.
 */
describe("instructionRecordsStatement", () => {
  const node = (id: string, status: string, content: Record<string, unknown>) =>
    ({ id, revision: { status, content: { _type: "document", ...content } } }) as unknown as Parameters<typeof instructionRecordsStatement>[0][number];

  it("Given profiles among documents, Then each becomes an instruction, an unnamed one renamed", () => {
    expect(
      instructionRecordsStatement([
        node("node:p2", "established", { record: "profile", title: "Untitled profile" }),
        node("node:p1", "established", { record: "profile", title: "Blog post" }),
        node("node:done", "established", { record: "instruction", title: "Kept" }),
        node("node:src", "established", { record: "source", title: "A paper" }),
        node("node:cand", "candidate", { record: "profile" }),
      ]),
    ).toEqual({
      statement: "SET i0.record = $recordNow; SET i1.record = $recordNow, i1.title = $titleNow",
      parameters: { recordNow: "instruction", titleNow: "Untitled instruction", i0NodeId: "node:p1", i1NodeId: "node:p2" },
    });
  });

  it("Given no profile left, Then the script is empty", () => {
    expect(instructionRecordsStatement([node("node:done", "established", { record: "instruction" })])).toEqual({ statement: "", parameters: {} });
  });
});
