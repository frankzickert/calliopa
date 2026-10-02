import { describe, expect, it } from "vitest";
import { retireRefinementStatement, retireSetAsideStatement } from "./migrations";

// The migration that retires every block set aside (BO_0315_008): the value
// cleared first, then the containment closed and the block related retired
// from its document; a block retired already only loses its value.
describe("retireSetAsideStatement", () => {
  it("clears, closes and relates each block set aside, in one script", () => {
    expect(
      retireSetAsideStatement([
        { blockId: "b1", containmentId: "rel:c1", documentId: "doc-1" },
        { blockId: "b2", containmentId: null, documentId: null },
      ]),
    ).toEqual({
      statement: "SET x0.disposition = $x0standing; CLOSE c0; RELATE d0 -[r0:retired]-> x0; SET x1.disposition = $x1standing",
      parameters: {
        x0NodeId: "node:b1",
        x0standing: null,
        c0RelationId: "rel:c1",
        d0: "node:doc-1",
        x1NodeId: "node:b2",
        x1standing: null,
      },
    });
  });

  it("answers an empty statement when nothing was set aside", () => {
    expect(retireSetAsideStatement([])).toEqual({ statement: "", parameters: {} });
  });
});

// The migration that deletes what refinement stored (BO_0324_010): the
// properties it wrote cleared, the relations touching what goes closed, and
// the nodes retired, in that order and in one script.
describe("retireRefinementStatement", () => {
  it("clears, closes and retires, in one script", () => {
    expect(
      retireRefinementStatement({
        clear: [
          { nodeId: "b1", properties: ["kind"] },
          { nodeId: "doc-1", properties: ["phase", "acceptedAt"] },
        ],
        close: ["rel:a1", "rel:s1"],
        retire: ["claim-1", "rel-node-1"],
      }),
    ).toEqual({
      statement:
        "SET p0.kind = $p0none; SET p1.phase = $p1none, p1.acceptedAt = $p1none; CLOSE e0; CLOSE e1; RETIRE n0; RETIRE n1",
      parameters: {
        p0NodeId: "node:b1",
        p0none: null,
        p1NodeId: "node:doc-1",
        p1none: null,
        e0RelationId: "rel:a1",
        e1RelationId: "rel:s1",
        n0NodeId: "node:claim-1",
        n1NodeId: "node:rel-node-1",
      },
    });
  });

  it("answers an empty statement when refinement stored nothing", () => {
    expect(retireRefinementStatement({ clear: [], close: [], retire: [] })).toEqual({ statement: "", parameters: {} });
  });
});

