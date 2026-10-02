import { describe, expect, it } from "vitest";

import { readDocument, readRetiredBlocks } from "~/extensions/documents/server/documents";
import { MIGRATIONS } from "~/extensions/documents/server/migrations";
import { query, write } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";

/**
 * The migration that retires every block set aside (`BO_0315_008`), over a
 * real CCGW and a real kernel: the harness writes a document holding a block
 * stored as discarded, one as resolved and one kept, then narrows the text
 * declaration as the release does (`seedSetAside`). The route's statement,
 * written as the kernel's migration runner writes it, retires the two with
 * their values cleared and leaves the kept one; run again it has nothing to
 * change. Without the harness the suite skips.
 */
const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

describe.skipIf(!configured)("retiring the blocks set aside (BO_0315_008)", () => {
  it("Given blocks stored as discarded and resolved, Then the migration retires both with their values cleared, keeps the rest, and has nothing left to do after", async () => {
    const before = ok<{ blocks: readonly { blockId: string }[] }>(await readDocument("doc-set-aside"));
    expect(before.blocks.map((block) => block.blockId)).toEqual(["blk-set-aside-discarded", "blk-set-aside-resolved", "blk-set-aside-kept"]);

    const statement = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["retire-discarded"]!());
    expect(statement.statement).toContain("RELATE");
    ok(await write(statement.statement, statement.parameters, "the documents migration migration-bo-0315"));

    const after = ok<{ blocks: readonly { blockId: string }[] }>(await readDocument("doc-set-aside"));
    expect(after.blocks.map((block) => block.blockId)).toEqual(["blk-set-aside-kept"]);
    const retired = ok<readonly { blockId: string }[]>(await readRetiredBlocks("doc-set-aside"));
    expect(retired.map((block) => block.blockId).sort()).toEqual(["blk-set-aside-discarded", "blk-set-aside-resolved"]);
    const values = ok<{ nodes: readonly { id: string; revision: { content?: Record<string, unknown> } }[] }>(
      await query({ statement: "MATCH (b:text) RETURN GRAPH b ROOT b", roots: ["node:blk-set-aside-discarded", "node:blk-set-aside-resolved"], purpose: "migration test" }),
    );
    for (const node of values.nodes) expect(node.revision.content?.["disposition"] ?? null).toBeNull();

    const again = ok<{ statement: string }>(await MIGRATIONS["retire-discarded"]!());
    expect(again.statement).toBe("");
  });
});

/**
 * The migration that deletes what refinement stored (`BO_0324_010`), over the
 * same real CCGW: the harness writes what an instance held before `BO_0324`
 * (`seedRefinement`), and the route reads it and answers its script. The
 * script retires the claims, the judgement, the relation between the claims
 * and the investigation, closes every edge on them and the derived block's,
 * and clears the block kind, the phase, its stamp and refinement's intention
 * — and names nothing of the document's blocks or of the relation between
 * them. The kernel's migration runner writes such a script through the core
 * as the owner, which the bridge this suite writes through refuses to every
 * other writer (`write_relation_retires_by_state`); that write is the
 * kernel's test (`BO_0324_002`).
 */
describe.skipIf(!configured)("deleting what refinement stored (BO_0324_010)", () => {
  it("Given refinement's claims, judgements, phase, kinds, derivations and investigations, Then the script deletes them and names nothing that stays", async () => {
    const answered = ok<{ statement: string; parameters: Record<string, unknown> }>(await MIGRATIONS["retire-refinement"]!());
    const steps = answered.statement.split("; ");
    const named = (step: string, suffix: string) => answered.parameters[`${step.split(/[ .]/u)[1]}${suffix}`];
    const retired = steps.filter((step) => step.startsWith("RETIRE ")).map((step) => named(step, "NodeId")).sort();
    expect(retired).toEqual(["node:clm-refined-a", "node:clm-refined-b", "node:doc-investigation", "node:jdg-refined", "node:rel-refined-claims"]);

    // Two asserts, the judges, the relation's source and target, and the
    // derived block's edge: six relations, closed before anything retires.
    const closed = steps.filter((step) => step.startsWith("CLOSE ")).map((step) => named(step, "RelationId"));
    expect(closed).toHaveLength(6);
    const lastClose = steps.map((step) => step.startsWith("CLOSE ")).lastIndexOf(true);
    expect(steps.findIndex((step) => step.startsWith("RETIRE "))).toBeGreaterThan(lastClose);
    const relations = await query({ statement: "MATCH (r:relation)-[e]->(b) RETURN GRAPH r, e, b ROOT r", roots: ["node:rel-refined-blocks"], unbounded: true, purpose: "migration test" });
    for (const relation of ok<{ relations: readonly { id: string }[] }>(relations).relations) expect(closed).not.toContain(relation.id);

    const cleared = Object.fromEntries(
      steps
        .filter((step) => step.startsWith("SET "))
        .map((step) => [named(step, "NodeId"), [...step.matchAll(/\.(\w+) = /gu)].map((match) => match[1]).sort()]),
    );
    expect(cleared).toEqual({
      "node:blk-refined-a": ["kind"],
      "node:doc-refined": ["acceptedAt", "intention", "phase"],
    });
    expect(retired).not.toContain("node:doc-refined");
    expect(retired).not.toContain("node:rel-refined-blocks");
  });
});
