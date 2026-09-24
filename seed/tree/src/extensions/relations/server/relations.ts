import { randomUUID } from "node:crypto";

import { normalizeRuns } from "~/lib/runs";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import { query } from "~/server/ccgw/client";
import { commit } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";

import { RELATION_TYPE, SOURCE, TARGET, type RelationInput } from "../lib/relation";

/**
 * Declaring a relation as truth (`BO_0288_017`), moved here from `documents`'
 * `server/work-ops.ts` and re-anchored on blocks in the same step: a person's
 * declared relation is truth, where a run only ever proposes one.
 *
 * Both ends are blocks. The claim resolution this carried until `BO_0288`
 * — reading a document's claims, drafting one where a block asserted none —
 * is gone with the vocabulary, which is `calliopa-refine`'s now.
 *
 * The read is this extension's own rather than a call into `documents`'
 * server: an end may be a block of any document, so what it needs is that the
 * block stands, is held by an active containment, and is not discarded.
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

export interface WrittenRelation {
  readonly relationId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

const CONTAINS = "CONTAINS";
const TEXT_TYPE = "text";

/**
 * A block an end may anchor on: it stands at the pin, a document holds it by
 * an active containment — a retired block holds no anchor — and it is not
 * discarded. Answers the node ref to relate to.
 */
async function anchor(end: { readonly blockId: string }, which: string): Promise<GraphOutcome<string>> {
  const ref = nodeRef(end.blockId);
  const found = await query({
    statement: `MATCH (d)-[k:${CONTAINS}]->(b) RETURN GRAPH d, k, b ROOT b`,
    roots: [ref],
    purpose: "relation end",
  });
  if (found.outcome !== "success") {
    return found.outcome === "noResult"
      ? refuse("unknownBlock", `Block ${end.blockId} is not in the graph.`)
      : (found as GraphOutcome<never>);
  }
  const block = found.result.nodes.find((candidate) => candidate.id === ref);
  if (block === undefined) return refuse("unknownBlock", `Block ${end.blockId} is not in the graph.`);
  const content = block.revision.content ?? {};
  if (content["_type"] !== TEXT_TYPE) {
    return refuse("notAText", `Block ${end.blockId} is a ${String(content["_type"])}; a relation anchors a text block.`);
  }
  const held = found.result.relations.some(
    (relation) => relation.type === CONTAINS && relation.validity.status === "active" && relation.to.nodeId === ref,
  );
  if (!held) return refuse("retiredBlock", `Block ${end.blockId} is retired; a relation never anchors on a retired block.`);
  if (content["disposition"] === "discarded") {
    return refuse("discardedBlock", `Block ${end.blockId} is discarded; a relation never anchors on a discarded block.`);
  }
  void which;
  return { outcome: "success", result: bareId(block.id) };
}

/** Declares a relation between two blocks, as truth, with its reason. */
export async function declareRelation(input: {
  readonly relation: RelationInput;
}): Promise<GraphOutcome<WrittenRelation>> {
  if (input.relation.reason.length === 0) {
    return refuse("noReason", "A relation gives its reason: the condition that connects its ends.");
  }
  const source = await anchor(input.relation.source, "source");
  if (source.outcome !== "success") return source as GraphOutcome<never>;
  const target = await anchor(input.relation.target, "target");
  if (target.outcome !== "success") return target as GraphOutcome<never>;
  if (source.result === target.result) {
    return refuse("sameBlock", "A relation's source and target are two different blocks.");
  }
  const relationId = randomUUID();
  const parameters: Record<string, unknown> = {
    r_id: relationId,
    r_kind: input.relation.kind,
    r_reason: normalizeRuns([...input.relation.reason]),
    r_origin: input.relation.origin ?? "declared",
    rrs: nodeRef(relationId),
    rrt: nodeRef(relationId),
    rbs: nodeRef(source.result),
    rbt: nodeRef(target.result),
  };
  const statements = [
    `CREATE (r:${RELATION_TYPE} {id: $r_id, kind: $r_kind, reason: $r_reason, origin: $r_origin, status: "established"})`,
    `RELATE rrs -[res:${SOURCE}]-> rbs`,
    `RELATE rrt -[ret:${TARGET}]-> rbt`,
  ];
  return commit(
    statements.join("; "),
    parameters,
    `declare a ${input.relation.kind} relation`,
    async (dataRevision, revisionOf) => ({
      relationId,
      revisionId: await revisionOf(relationId),
      dataRevision,
    }),
  );
}
