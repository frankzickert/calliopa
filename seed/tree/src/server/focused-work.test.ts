import { describe, expect, it } from "vitest";
import { FOCUSES, focusScript } from "./focused-work";

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
