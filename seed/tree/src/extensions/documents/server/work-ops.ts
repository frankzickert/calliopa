import { normalizeRuns, type Run } from "~/lib/runs";
import { query } from "~/server/ccgw/client";
import { commit, one } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";
import { type BlockView } from "./assemble";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import { readDocument, type WrittenBlock } from "./documents";
import {
  draftClaimScript,
  farBlock,
  isBlockKind,
  readClaims,
  readRelationsOf,
  relationScript,
  RELATION_TYPE,
  type ClaimView,
  type RelationEndInput,
  type RelationInput,
  type RelationState,
} from "./work";

/**
 * The work operations a person performs as truth (`BO_0244_007`): a block's
 * kind, its claims, and reason-bearing relations between claims. Each is one
 * atomic script through the bridge's `write` verb naming its base, so a
 * stale base is a conflict and a refusal leaves the graph as it was. A
 * person's declared relation is truth — user decision, 2026-09-13 — where a
 * run only ever proposes one (`documents.ts`, `proposeDocumentChanges`).
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const conflict = <T>(nodeId: string, expected: string, current: string | null): GraphOutcome<T> => ({
  outcome: "conflict",
  conflicts: [{ nodeId: nodeRef(nodeId), expectedRevisionId: expected, currentRevisionId: current }],
});

async function textBlock(
  documentId: string,
  blockId: string,
  baseRevisionId?: string,
): Promise<GraphOutcome<BlockView>> {
  const document = await readDocument(documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const block = document.result.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined) return refuse("unknownBlock", `Block ${blockId} is not in this document.`);
  if (block.kind !== "text") return refuse("blockKind", `Block ${blockId} is a ${block.kind} block.`);
  if (baseRevisionId !== undefined && block.revisionId !== baseRevisionId) {
    return conflict(blockId, baseRevisionId, block.revisionId);
  }
  return { outcome: "success", result: block };
}

/** Sets what a block is, or clears it. */
export async function setBlockKind(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly blockKind: string | null;
}): Promise<GraphOutcome<WrittenBlock>> {
  const block = await textBlock(input.documentId, input.blockId, input.baseRevisionId);
  if (block.outcome !== "success") return block as GraphOutcome<never>;
  if (input.blockKind !== null && !isBlockKind(input.blockKind)) {
    return refuse("blockKind", `${input.blockKind} is not a kind a block can be.`);
  }
  return commit(
    "SET b.kind = $kind",
    { bNodeId: nodeRef(input.blockId), kind: input.blockKind },
    `set the kind of block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

export interface WrittenClaim {
  readonly blockId: string;
  readonly claimId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

/** Adds a claim a block asserts. */
export async function addClaim(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly text: readonly Run[];
}): Promise<GraphOutcome<WrittenClaim>> {
  const block = await textBlock(input.documentId, input.blockId, input.baseRevisionId);
  if (block.outcome !== "success") return block as GraphOutcome<never>;
  if (input.text.length === 0) return refuse("emptyClaim", "A claim carries words.");
  const parameters: Record<string, unknown> = {};
  const drafted = draftClaimScript("a", input.blockId, input.text, parameters, true);
  return commit(
    drafted.statements.join("; "),
    parameters,
    `add a claim to block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      claimId: drafted.claimId,
      revisionId: await revisionOf(drafted.claimId),
      dataRevision,
    }),
  );
}

async function claimOf(blockId: string, claimId: string): Promise<GraphOutcome<ClaimView>> {
  const claims = await readClaims([blockId]);
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const claim = (claims.result.byBlock[blockId] ?? []).find((candidate) => candidate.claimId === claimId);
  if (claim === undefined) return refuse("unknownClaim", `Claim ${claimId} is not asserted by block ${blockId}.`);
  return { outcome: "success", result: claim };
}

/** Revises a claim's words, keeping its identity and what anchors on it. */
export async function reviseClaim(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly claimId: string;
  readonly baseRevisionId: string;
  readonly text: readonly Run[];
}): Promise<GraphOutcome<WrittenClaim>> {
  const block = await textBlock(input.documentId, input.blockId);
  if (block.outcome !== "success") return block as GraphOutcome<never>;
  const claim = await claimOf(input.blockId, input.claimId);
  if (claim.outcome !== "success") return claim as GraphOutcome<never>;
  if (claim.result.revisionId !== input.baseRevisionId) {
    return conflict(input.claimId, input.baseRevisionId, claim.result.revisionId);
  }
  if (input.text.length === 0) return refuse("emptyClaim", "A claim carries words.");
  return commit(
    "SET c.text = $text",
    { cNodeId: nodeRef(input.claimId), text: normalizeRuns([...input.text]) },
    `revise claim ${input.claimId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      claimId: input.claimId,
      revisionId: await revisionOf(input.claimId),
      dataRevision,
    }),
  );
}

/** Drops a claim — a `RETIRE` of the claim node — refused while a relation
 * still anchors on it, since the relation would lose an end. */
export async function dropClaim(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly claimId: string;
}): Promise<GraphOutcome<{ readonly claimId: string; readonly dataRevision: string }>> {
  const block = await textBlock(input.documentId, input.blockId);
  if (block.outcome !== "success") return block as GraphOutcome<never>;
  const claim = await claimOf(input.blockId, input.claimId);
  if (claim.outcome !== "success") return claim as GraphOutcome<never>;
  const anchored = await readRelationsOf([input.claimId]);
  if (anchored.outcome !== "success") return anchored as GraphOutcome<never>;
  if (anchored.result.length > 0) {
    return refuse(
      "claimAnchored",
      `Claim ${input.claimId} anchors ${anchored.result.length} relation${anchored.result.length === 1 ? "" : "s"}; retire them first.`,
    );
  }
  return commit(
    "RETIRE c",
    { cNodeId: nodeRef(input.claimId) },
    `drop claim ${input.claimId} of block ${input.blockId}`,
    async (dataRevision) => ({ claimId: input.claimId, dataRevision }),
  );
}

export interface WrittenRelation {
  readonly relationId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
  /** The claims drafted for ends that named a block with the words to draft. */
  readonly draftedClaims: readonly { readonly blockId: string; readonly claimId: string }[];
}

/**
 * Resolves one end of a relation to the claim it anchors on, drafting the
 * claim into the script where a block asserts none and the words are given.
 * A block of this document is judged from the document read; a block of
 * another document by its own read.
 */
async function resolveEnd(
  alias: string,
  end: RelationEndInput,
  document: { readonly blocks: readonly BlockView[]; readonly claims: Readonly<Record<string, readonly ClaimView[]>> },
  parameters: Record<string, unknown>,
  statements: string[],
  drafted: { blockId: string; claimId: string }[],
): Promise<GraphOutcome<string>> {
  if ("claimId" in end) {
    const found = await one(end.claimId, "relation end");
    if (found.outcome !== "success") return found as GraphOutcome<never>;
    const node = found.result.nodes.find((candidate) => candidate.id === nodeRef(end.claimId));
    if (node === undefined) return refuse("unknownClaim", `Claim ${end.claimId} is not in the graph.`);
    return { outcome: "success", result: end.claimId };
  }
  let claims: readonly ClaimView[];
  const here = document.blocks.find((block) => block.blockId === end.blockId);
  if (here !== undefined) {
    if (here.kind === "text" && here.standing === "discarded") {
      return refuse("discardedBlock", `Block ${end.blockId} is discarded; a relation never anchors on a discarded block.`);
    }
    claims = document.claims[end.blockId] ?? [];
  } else {
    const far = await farBlock(end.blockId);
    if (far.outcome !== "success") return far as GraphOutcome<never>;
    claims = far.result.claims;
  }
  if (end.claim !== undefined && end.claim.length > 0) {
    const claim = draftClaimScript(alias, end.blockId, end.claim, parameters, true);
    statements.push(...claim.statements);
    drafted.push({ blockId: end.blockId, claimId: claim.claimId });
    return { outcome: "success", result: claim.claimId };
  }
  if (claims.length === 1) return { outcome: "success", result: (claims[0] as ClaimView).claimId };
  if (claims.length === 0) {
    return refuse("noClaim", `Block ${end.blockId} asserts no claim yet; give the claim's words to draft one.`);
  }
  return refuse("severalClaims", `Block ${end.blockId} asserts ${claims.length} claims; name one by claimId.`);
}

/** Declares a relation between two claims, as truth, with its reason. */
export async function declareRelation(input: {
  readonly documentId: string;
  readonly relation: RelationInput;
}): Promise<GraphOutcome<WrittenRelation>> {
  const document = await readDocument(input.documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  if (input.relation.reason.length === 0) {
    return refuse("noReason", "A relation gives its reason: the condition that connects its ends.");
  }
  const claims = await readClaims(document.result.blocks.map((block) => block.blockId));
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const scope = { blocks: document.result.blocks, claims: claims.result.byBlock };
  const parameters: Record<string, unknown> = {};
  const statements: string[] = [];
  const drafted: { blockId: string; claimId: string }[] = [];
  const source = await resolveEnd("s", input.relation.source, scope, parameters, statements, drafted);
  if (source.outcome !== "success") return source as GraphOutcome<never>;
  const target = await resolveEnd("t", input.relation.target, scope, parameters, statements, drafted);
  if (target.outcome !== "success") return target as GraphOutcome<never>;
  if (source.result === target.result) return refuse("sameClaim", "A relation's source and target are two claims.");
  const relation = relationScript(
    "r",
    { kind: input.relation.kind, reason: input.relation.reason, origin: input.relation.origin ?? "declared" },
    source.result,
    target.result,
    parameters,
    true,
  );
  statements.push(...relation.statements);
  return commit(
    statements.join("; "),
    parameters,
    `declare a ${input.relation.kind} relation`,
    async (dataRevision, revisionOf) => ({
      relationId: relation.relationId,
      revisionId: await revisionOf(relation.relationId),
      dataRevision,
      draftedClaims: drafted,
    }),
  );
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
