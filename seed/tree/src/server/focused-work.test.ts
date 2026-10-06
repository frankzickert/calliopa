import { describe, expect, it } from "vitest";
import { adoptScript, emptiedScript, FOCUSES, focusScript } from "./focused-work";

/**
 * Focused work is the shell's capability and the vocabulary is the
 * extension's, so the child is planned by whoever owns the target kind and
 * the shell commits that plan with its own edge. What this proves is that the
 * two are one write. CA_0065_002
 */
describe("the focused-work script", () => {
  const plan = {
    itemId: "child-1",
    title: "Request-local caching could reduce repeated checks.",
    statements: ["CREATE (d:document {id: $did})", "CREATE (b:text {id: $bid})", "RELATE cd -[c:contains]-> cb"],
    parameters: { did: "child-1", bid: "block-1", cd: "node:child-1", cb: "node:block-1" },
  };

  it("Given a plan, Then the edge onto the block is the last statement of the same script", () => {
    const script = focusScript(plan, "blk-a");
    expect(script.statements.slice(0, 3)).toEqual(plan.statements);
    expect(script.statements.at(-1)).toBe(`RELATE fwChild -[f:${FOCUSES}]-> fwBlock`);
    // One script, so a child never stands without the edge that makes it
    // focused work.
    expect(script.statements).toHaveLength(plan.statements.length + 1);
  });

  it("Given a plan, Then its parameters travel with the shell's own two refs", () => {
    const script = focusScript(plan, "blk-a");
    expect(script.parameters).toMatchObject(plan.parameters);
    expect(script.parameters["fwChild"]).toBe("node:child-1");
    expect(script.parameters["fwBlock"]).toBe("node:blk-a");
  });

  it("Given a plan whose parameters name the shell's refs, Then the shell's own win", () => {
    // The names are the shell's; an extension that happens to use them
    // cannot redirect the edge away from the block that was opened.
    const script = focusScript({ ...plan, parameters: { fwBlock: "node:elsewhere" } }, "blk-a");
    expect(script.parameters["fwBlock"]).toBe("node:blk-a");
  });
});

/** An empty child goes in one write with its edge, so the parent block never
 * points at a child that is gone. CA_0083_001 */
describe("the script that removes an empty focused work", () => {
  const plan = { statements: ["RETIRE fwGone"], parameters: { fwGoneNodeId: "node:child-1" } };

  it("Given the kind's removal, Then the edge is closed in the same script, from the child", () => {
    const script = emptiedScript(plan, "child-1", "rel:f1");
    expect(script.statements).toEqual(["RETIRE fwGone", "CLOSE fwEdge"]);
    expect(script.parameters).toEqual({ fwGoneNodeId: "node:child-1", fwEdgeRelationId: "rel:f1", fwEdgeFrom: "node:child-1" });
  });

  it("Given a removal whose parameters name the shell's edge, Then the shell's own win", () => {
    const script = emptiedScript({ ...plan, parameters: { fwEdgeRelationId: "rel:elsewhere" } }, "child-1", "rel:f1");
    expect(script.parameters["fwEdgeRelationId"]).toBe("rel:f1");
  });
});

/**
 * A document dropped into a document is adopted by a new block (`documents`'
 * `DO_0043_001`): the extension's statements for the block, the close of the
 * edge the child held elsewhere, and the edge onto the new block, in one
 * script, so the child focuses one block throughout.
 */
describe("the adoption script", () => {
  const plan = {
    blockId: "blk-new",
    statements: ["CREATE (ab:text {id: $ab_id})", "RELATE adDocument -[ac:contains]-> adBlock"],
    parameters: { ab_id: "blk-new", adDocument: "node:doc-a", adBlock: "node:blk-new" },
  };

  it("Given a child that focuses nothing, Then the block is made and the edge onto it is the last statement, with no close", () => {
    const script = adoptScript(plan, "doc-b", null);
    expect(script.statements).toEqual([...plan.statements, `RELATE fwChild -[f:${FOCUSES}]-> fwBlock`]);
    expect(script.parameters["fwChild"]).toBe("node:doc-b");
    expect(script.parameters["fwBlock"]).toBe("node:blk-new");
    expect(script.parameters).not.toHaveProperty("fwHeldRelationId");
  });

  it("Given a child that focuses a block elsewhere, Then that edge closes in the same script, before the new one", () => {
    const script = adoptScript(plan, "doc-b", { relationId: "rel-old" });
    expect(script.statements).toEqual([...plan.statements, "CLOSE fwHeld", `RELATE fwChild -[f:${FOCUSES}]-> fwBlock`]);
    expect(script.parameters["fwHeldRelationId"]).toBe("rel-old");
    // The close is read from the edge's origin, the child.
    expect(script.parameters["fwHeldFrom"]).toBe("node:doc-b");
  });

  it("Given a plan whose parameters name the shell's refs, Then the shell's own win", () => {
    const script = adoptScript({ ...plan, parameters: { ...plan.parameters, fwBlock: "node:elsewhere", fwChild: "node:other" } }, "doc-b", null);
    expect(script.parameters["fwBlock"]).toBe("node:blk-new");
    expect(script.parameters["fwChild"]).toBe("node:doc-b");
  });
});
