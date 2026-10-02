import { describe, expect, it } from "vitest";
import { clearProfileGenerationStatement, retireRefinementStatement, retireSetAsideStatement } from "./migrations";

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


// A profile's generation setup goes with calliopa-bootstrap's BO_0336: every
// established document holding profileType or imageBackend has what it holds
// cleared, and nothing else is touched (BO_0336_040).
describe("clearProfileGenerationStatement", () => {
  const node = (id: string, status: string, content: Record<string, unknown>) =>
    ({ id, revision: { status, content: { _type: "document", ...content } } }) as unknown as Parameters<typeof clearProfileGenerationStatement>[0][number];

  it("clears what each established document holds of the setup, in one script", () => {
    expect(
      clearProfileGenerationStatement([
        node("node:p2", "established", { record: "profile", profileType: "image", imageBackend: "higgsfield" }),
        node("node:p1", "established", { record: "profile", profileType: "video" }),
        node("node:plain", "established", { title: "No profile" }),
        node("node:cand", "candidate", { profileType: "image" }),
      ]),
    ).toEqual({
      statement: "SET g0.profileType = null; SET g1.profileType = null, g1.imageBackend = null",
      parameters: { g0NodeId: "node:p1", g1NodeId: "node:p2" },
    });
  });

  it("answers an empty statement when no document holds it", () => {
    expect(clearProfileGenerationStatement([node("node:plain", "established", { title: "x" })])).toEqual({ statement: "", parameters: {} });
  });
});
