import { normalizeRuns, type Run } from "~/lib/runs";
import { query } from "~/server/ccgw/client";
import { commit } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import { RELATION_TYPE, type RelationState } from "./work";

/**
 * The relation operations a person performs as truth (`BO_0244_007`): a
 * relation's reason and its state. Each is one atomic script through the
 * bridge's `write` verb naming its base, so a stale base is a conflict and a
 * refusal leaves the graph as it was. A person declares a relation through
 * `relations`' commands route; a run only ever proposes one (`documents.ts`,
 * `proposeDocumentChanges`).
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const conflict = <T>(nodeId: string, expected: string, current: string | null): GraphOutcome<T> => ({
  outcome: "conflict",
  conflicts: [{ nodeId: nodeRef(nodeId), expectedRevisionId: expected, currentRevisionId: current }],
});

export interface WrittenRelation {
  readonly relationId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

async function relationBase(relationId: string, baseRevisionId: string): Promise<GraphOutcome<string>> {
  const found = await query({
    statement: `MATCH (r:${RELATION_TYPE}) RETURN GRAPH r`,
    roots: [nodeRef(relationId)],
    purpose: "relation base",
  });
  if (found.outcome !== "success") {
    return found.outcome === "noResult" ? refuse("unknownRelation", `Relation ${relationId} is not in the graph.`) : (found as GraphOutcome<never>);
  }
  const node = found.result.nodes.find((candidate) => candidate.id === nodeRef(relationId));
  if (node === undefined) return refuse("unknownRelation", `Relation ${relationId} is not in the graph.`);
  if (node.revision.id !== baseRevisionId) return conflict(relationId, baseRevisionId, node.revision.id);
  return { outcome: "success", result: bareId(node.id) };
}

/** Gives a relation a new reason. */
export async function reviseRelationReason(input: {
  readonly relationId: string;
  readonly baseRevisionId: string;
  readonly reason: readonly Run[];
}): Promise<GraphOutcome<{ readonly relationId: string; readonly revisionId: string; readonly dataRevision: string }>> {
  const base = await relationBase(input.relationId, input.baseRevisionId);
  if (base.outcome !== "success") return base as GraphOutcome<never>;
  if (input.reason.length === 0) return refuse("noReason", "A relation gives its reason.");
  return commit(
    "SET r.reason = $reason",
    { rNodeId: nodeRef(input.relationId), reason: normalizeRuns([...input.reason]) },
    `revise the reason of relation ${input.relationId}`,
    async (dataRevision, revisionOf) => ({
      relationId: input.relationId,
      revisionId: await revisionOf(input.relationId),
      dataRevision,
    }),
  );
}

/** Sets a relation's state; `declared` clears the property, as absent means
 * declared. `retired` is how a relation ends: never `RETIRE`, which would hide
 * its record from every read. */
export async function setRelationState(input: {
  readonly relationId: string;
  readonly baseRevisionId: string;
  readonly state: RelationState;
}): Promise<GraphOutcome<{ readonly relationId: string; readonly revisionId: string; readonly dataRevision: string }>> {
  const base = await relationBase(input.relationId, input.baseRevisionId);
  if (base.outcome !== "success") return base as GraphOutcome<never>;
  return commit(
    "SET r.state = $state",
    { rNodeId: nodeRef(input.relationId), state: input.state === "declared" ? null : input.state },
    `set relation ${input.relationId} ${input.state}`,
    async (dataRevision, revisionOf) => ({
      relationId: input.relationId,
      revisionId: await revisionOf(input.relationId),
      dataRevision,
    }),
  );
}
