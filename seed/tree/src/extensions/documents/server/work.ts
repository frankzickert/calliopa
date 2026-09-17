import { randomUUID } from "node:crypto";

import { normalizeRuns, sameRuns, type Run } from "~/lib/runs";
import { query, type ReadNode, type ReadResult } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import { CONTAINS, type BlockView, type DocumentView } from "./assemble";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { DOCUMENT_TYPE } from "./vocabulary";

/**
 * The work vocabulary over documents (`BO_0244`): a block's kind, the claims
 * it asserts, the relation node that says why two claims are connected, and
 * the `derivedFrom` provenance edge. The graph declares the shapes as
 * `ui.shell` members (`BO_0244_006`); this module reads them
 * (`BO_0244_008`, `BO_0244_009`) and compiles the proposal items a run or a
 * reader stages against them (`BO_0244_010`). The operations that write them
 * as truth are `work-ops.ts` (`BO_0244_007`).
 *
 * A relation is a node because a `Relation` stores no properties and the
 * reason is what carries consequence. Its `source` and `target` edges leave
 * the relation node, so staging one revises neither claim nor block; a block
 * asserts its claims through `asserts` edges, which leave the block.
 */

export const CLAIM_TYPE = "claim";
export const RELATION_TYPE = "relation";
export const ASSERTS = "asserts";
export const SOURCE = "source";
export const TARGET = "target";
export const DERIVED_FROM = "derivedFrom";

/** What a block is, in the decision vocabulary: the material's full list.
 * User decision, 2026-09-13. `synthesis`, `tension`, `frontier` and `next`
 * are the derived kinds a system run maintains (`BO_0246`). */
export const BLOCK_KINDS = [
  "assertion",
  "question",
  "observation",
  "assumption",
  "alternative",
  "argument",
  "evidence",
  "concern",
  "consequence",
  "requirement",
  "proposal",
  "decision",
  "synthesis",
  "tension",
  "frontier",
  "next",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const RELATION_KINDS = [
  "dependsOn",
  "supports",
  "contradicts",
  "qualifies",
  "constrains",
  "implements",
  "supersedes",
  "evidences",
  "opensQuestionIn",
  "affectedBy",
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const RELATION_ORIGINS = ["declared", "derived", "inferred"] as const;
export type RelationOrigin = (typeof RELATION_ORIGINS)[number];

/** A relation's lifecycle; absent means declared, and *proposed* is the node
 * being a candidate rather than a state. A relation ends by `retired` and is
 * never retired as a node, so its record stays readable. */
export const RELATION_STATES = ["declared", "exercised", "needsReview", "orphaned", "retired"] as const;
export type RelationState = (typeof RELATION_STATES)[number];

export const isBlockKind = (value: unknown): value is BlockKind =>
  typeof value === "string" && (BLOCK_KINDS as readonly string[]).includes(value);
export const isRelationKind = (value: unknown): value is RelationKind =>
  typeof value === "string" && (RELATION_KINDS as readonly string[]).includes(value);
export const isRelationOrigin = (value: unknown): value is RelationOrigin =>
  typeof value === "string" && (RELATION_ORIGINS as readonly string[]).includes(value);
export const isRelationState = (value: unknown): value is RelationState =>
  typeof value === "string" && (RELATION_STATES as readonly string[]).includes(value);

/** One claim a block asserts. */
export interface ClaimView {
  readonly claimId: string;
  readonly revisionId: string;
  /** `established`, or `candidate` when read through a proposal's overlay. */
  readonly status: string;
  readonly text: readonly Run[];
}

/** One end of a relation: the claim, the block asserting it, and that block's
 * document, wherever it is. */
export interface RelationEnd {
  readonly claimId: string;
  readonly blockId: string;
  readonly documentId: string;
  readonly documentTitle: string;
  readonly status: string;
  readonly text: readonly Run[];
}

/**
 * Where a relation came from, as the layer says it on focus: its origin, who
 * drafted its reason, who confirmed it and who edited the reason after —
 * read from the relation node's history and its group's decisions, so
 * confirmation launders nothing (`BO_0247_007`).
 */
export interface RelationProvenance {
  readonly origin: string;
  /** The author of the relation's first revision. */
  readonly draftedBy: string;
  /** The authors of the revisions whose reason differs from the one before, oldest first. */
  readonly editedBy: readonly string[];
  /** The author of the group revision that first recorded the relation accepted; null for a relation declared directly. */
  readonly confirmedBy: string | null;
}

export interface RelationView {
  readonly relationId: string;
  readonly revisionId: string;
  readonly status: string;
  readonly kind: string;
  readonly reason: readonly Run[];
  readonly origin: string;
  readonly state: RelationState;
  readonly source: RelationEnd;
  readonly target: RelationEnd;
  readonly provenance?: RelationProvenance;
}

/** A document's claims by block, and every relation anchored on them. */
export interface DocumentRelations {
  readonly documentId: string;
  readonly claims: Readonly<Record<string, readonly ClaimView[]>>;
  readonly relations: readonly RelationView[];
}

/** The four words provenance is drawn in, one table with the kernel's
 * `read_document` (`BO_0244_009`). */
export const PROVENANCE = {
  authored: "human-authored",
  drafted: "system-drafted",
  edited: "system-drafted, human-edited",
  maintained: "system-maintained",
} as const;
export type Provenance = (typeof PROVENANCE)[keyof typeof PROVENANCE];

export interface BlockProvenance {
  readonly blockId: string;
  /** Empty when the block has no established revision. */
  readonly provenance: Provenance | "";
  /** The blocks it was derived from, when a run maintains it. */
  readonly derivedFrom: readonly string[];
}

/** A revision was a run's when the agent principal wrote it (`BO_0206`). */
export const isAgentPrincipal = (createdBy: string): boolean => createdBy.startsWith("agent:");

/**
 * A block's established history — current revision first — read into one of
 * the four words. Candidates and rejected revisions are not the block's
 * story; only what was established counts.
 */
export function provenanceOf(
  revisions: readonly { readonly status: string; readonly createdBy: string }[],
  derived: boolean,
): Provenance | "" {
  const established = revisions.filter((revision) => revision.status === "established" || revision.status === "archived");
  if (established.length === 0) return "";
  const anyAgent = established.some((revision) => isAgentPrincipal(revision.createdBy));
  const allAgent = established.every((revision) => isAgentPrincipal(revision.createdBy));
  if (!anyAgent) return PROVENANCE.authored;
  if (allAgent && derived) return PROVENANCE.maintained;
  if (isAgentPrincipal(established[0]?.createdBy ?? "")) return PROVENANCE.drafted;
  return PROVENANCE.edited;
}

const runsOf = (value: unknown): readonly Run[] =>
  Array.isArray(value) ? normalizeRuns(value as readonly Run[]) : [];

const stateOf = (value: unknown): RelationState => (isRelationState(value) ? value : "declared");

/** A rooted read, empty rather than a refusal when nothing is reached. */
async function rooted(
  statement: string,
  roots: readonly string[],
  purpose: string,
  proposalOverlay?: string,
): Promise<GraphOutcome<ReadResult>> {
  if (roots.length === 0) {
    return { outcome: "success", result: { roots: [], nodes: [], relations: [], resolvedDataRevision: 0 } };
  }
  const outcome = await query({
    statement,
    roots,
    unbounded: true,
    purpose,
    ...(proposalOverlay === undefined ? {} : { proposalOverlay }),
  });
  if (outcome.outcome === "noResult") {
    return { outcome: "success", result: { roots: [], nodes: [], relations: [], resolvedDataRevision: 0 } };
  }
  return outcome;
}

const claimOf = (node: ReadNode): ClaimView => ({
  claimId: bareId(node.id),
  revisionId: node.revision.id,
  status: node.revision.status,
  text: runsOf(contentOf(node)["text"]),
});

/**
 * The claims the given blocks assert: block -asserts-> claim, rooted at the
 * blocks. Answers them by block, and the claim's block for each claim.
 */
export async function readClaims(
  blockIds: readonly string[],
  proposalOverlay?: string,
): Promise<GraphOutcome<{ readonly byBlock: Record<string, ClaimView[]>; readonly blockOf: Map<string, string> }>> {
  const read = await rooted(
    `MATCH (b)-[a:${ASSERTS}]->(c) RETURN GRAPH b, a, c ROOT b`,
    blockIds.map(nodeRef),
    "claims read",
    proposalOverlay,
  );
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const nodes = new Map(read.result.nodes.map((node) => [node.id, node]));
  const byBlock: Record<string, ClaimView[]> = {};
  const blockOf = new Map<string, string>();
  const wanted = new Set(blockIds.map(nodeRef));
  for (const relation of read.result.relations) {
    if (relation.type !== ASSERTS || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    if (!wanted.has(relation.fromNodeId)) continue;
    const node = nodes.get(relation.to.nodeId);
    if (node === undefined || typeOf(node) !== CLAIM_TYPE) continue;
    const blockId = bareId(relation.fromNodeId);
    (byBlock[blockId] ??= []).push(claimOf(node));
    blockOf.set(node.id, blockId);
  }
  return { outcome: "success", result: { byBlock, blockOf } };
}

/**
 * The relation nodes anchored on the given claims, with both ends resolved.
 * Two reads: the relations reached from the claims by reverse propagation —
 * through the one edge that lands on a claim here — then the same relations
 * forward, rooted at themselves, for the end that may be elsewhere.
 */
export async function readRelationsOf(
  claimIds: readonly string[],
  proposalOverlay?: string,
): Promise<GraphOutcome<readonly { readonly node: ReadNode; readonly source: string; readonly target: string }[]>> {
  const reverse = await rooted(
    `MATCH (r:${RELATION_TYPE})-[e]->(c) RETURN GRAPH r, e, c ROOT c`,
    claimIds.map(nodeRef),
    "relations read",
    proposalOverlay,
  );
  if (reverse.outcome !== "success") return reverse as GraphOutcome<never>;
  const relationRefs = reverse.result.nodes.filter((node) => typeOf(node) === RELATION_TYPE).map((node) => node.id);
  return readRelationEnds(relationRefs, proposalOverlay);
}

/** The given relation nodes with their source and target claim refs. */
export async function readRelationEnds(
  relationRefs: readonly string[],
  proposalOverlay?: string,
): Promise<GraphOutcome<readonly { readonly node: ReadNode; readonly source: string; readonly target: string }[]>> {
  const forward = await rooted(
    `MATCH (r:${RELATION_TYPE})-[e]->(c) RETURN GRAPH r, e, c ROOT r`,
    [...relationRefs].sort(),
    "relation ends",
    proposalOverlay,
  );
  if (forward.outcome !== "success") return forward as GraphOutcome<never>;
  const nodes = new Map(forward.result.nodes.map((node) => [node.id, node]));
  const ends = new Map<string, { source: string; target: string }>();
  for (const relation of forward.result.relations) {
    if ((relation.type !== SOURCE && relation.type !== TARGET) || relation.validity.status !== "active") continue;
    if (relation.to.nodeId === undefined || nodes.get(relation.fromNodeId) === undefined) continue;
    const pair = ends.get(relation.fromNodeId) ?? { source: "", target: "" };
    pair[relation.type] = relation.to.nodeId;
    ends.set(relation.fromNodeId, pair);
  }
  return {
    outcome: "success",
    result: [...ends.entries()]
      .filter(([ref]) => typeOf(nodes.get(ref) as ReadNode) === RELATION_TYPE)
      .map(([ref, pair]) => ({ node: nodes.get(ref) as ReadNode, ...pair }))
      .sort((left, right) => (left.node.id < right.node.id ? -1 : 1)),
  };
}

/**
 * The far ends of relations: claims of other documents, resolved to their
 * block and that block's document. Two rooted reads, only when a relation
 * crosses documents.
 */
async function readFarEnds(
  claimRefs: readonly string[],
  proposalOverlay?: string,
): Promise<GraphOutcome<Map<string, RelationEnd>>> {
  const ends = new Map<string, RelationEnd>();
  if (claimRefs.length === 0) return { outcome: "success", result: ends };
  const asserted = await rooted(
    `MATCH (b)-[a:${ASSERTS}]->(c) RETURN GRAPH b, a, c ROOT c`,
    [...claimRefs].sort(),
    "far claims",
    proposalOverlay,
  );
  if (asserted.outcome !== "success") return asserted as GraphOutcome<never>;
  const nodes = new Map(asserted.result.nodes.map((node) => [node.id, node]));
  const blockRefs: string[] = [];
  for (const relation of asserted.result.relations) {
    if (relation.type !== ASSERTS || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    const claim = nodes.get(relation.to.nodeId);
    if (claim === undefined) continue;
    ends.set(claim.id, {
      ...claimOf(claim),
      blockId: bareId(relation.fromNodeId),
      documentId: "",
      documentTitle: "",
    });
    blockRefs.push(relation.fromNodeId);
  }
  if (blockRefs.length === 0) return { outcome: "success", result: ends };
  const held = await rooted(
    `MATCH (d:${DOCUMENT_TYPE})-[k:${CONTAINS}]->(b) RETURN GRAPH d, k, b ROOT b`,
    [...new Set(blockRefs)].sort(),
    "far blocks' documents",
    proposalOverlay,
  );
  if (held.outcome !== "success") return held as GraphOutcome<never>;
  const documents = new Map(held.result.nodes.map((node) => [node.id, node]));
  const holder = new Map<string, { id: string; title: string }>();
  for (const relation of held.result.relations) {
    if (relation.type !== CONTAINS || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    const document = documents.get(relation.fromNodeId);
    if (document === undefined) continue;
    const title = contentOf(document)["title"];
    holder.set(relation.to.nodeId, { id: bareId(document.id), title: typeof title === "string" ? title : "" });
  }
  for (const [ref, end] of ends) {
    const document = holder.get(nodeRef(end.blockId));
    if (document !== undefined) ends.set(ref, { ...end, documentId: document.id, documentTitle: document.title });
  }
  return { outcome: "success", result: ends };
}

/**
 * A document's claims and the relations anchored on them, with both ends
 * resolved: the relations read (`BO_0244_008`). Built for hops and volume —
 * every read is rooted at what the previous one found, never the document's
 * neighbourhood, which the gateway truncates — so a document with no claims
 * costs one read and a connected one is complete.
 */
export async function relationsOf(
  document: DocumentView,
  proposalOverlay?: string,
): Promise<GraphOutcome<DocumentRelations>> {
  const claims = await readClaims(
    document.blocks.map((block) => block.blockId),
    proposalOverlay,
  );
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const claimRefs = [...claims.result.blockOf.keys()];
  const relations = await readRelationsOf(claimRefs, proposalOverlay);
  if (relations.outcome !== "success") return relations as GraphOutcome<never>;
  const far = await readFarEnds(
    relations.result.flatMap((entry) => [entry.source, entry.target]).filter((ref) => ref !== "" && !claims.result.blockOf.has(ref)),
    proposalOverlay,
  );
  if (far.outcome !== "success") return far as GraphOutcome<never>;
  const provenance = await relationProvenanceOf(relations.result.map((entry) => entry.node.id));
  if (provenance.outcome !== "success") return provenance as GraphOutcome<never>;
  const here = (ref: string): RelationEnd | null => {
    const blockId = claims.result.blockOf.get(ref);
    if (blockId === undefined) return null;
    const claim = (claims.result.byBlock[blockId] ?? []).find((candidate) => candidate.claimId === bareId(ref));
    if (claim === undefined) return null;
    return { ...claim, blockId, documentId: document.documentId, documentTitle: document.title };
  };
  const endOf = (ref: string): RelationEnd =>
    here(ref) ??
    far.result.get(ref) ?? { claimId: bareId(ref), blockId: "", documentId: "", documentTitle: "", status: "", text: [] };
  return {
    outcome: "success",
    result: {
      documentId: document.documentId,
      claims: claims.result.byBlock,
      relations: relations.result.map((entry) => {
        const view = relationOf(entry.node, endOf(entry.source), endOf(entry.target));
        const known = provenance.result.get(entry.node.id);
        return known === undefined ? view : { ...view, provenance: known };
      }),
    },
  };
}

export function relationOf(node: ReadNode, source: RelationEnd, target: RelationEnd): RelationView {
  const content = contentOf(node);
  return {
    relationId: bareId(node.id),
    revisionId: node.revision.id,
    status: node.revision.status,
    kind: typeof content["kind"] === "string" ? content["kind"] : "",
    reason: runsOf(content["reason"]),
    origin: typeof content["origin"] === "string" ? content["origin"] : "",
    state: stateOf(content["state"]),
    source,
    target,
  };
}

/** The reserved key a revision staged in a group carries: its group. */
const PROPOSAL_KEY = "_proposal";
const MEMBER_DECISIONS_KEY = "memberDecisions";

/**
 * Each relation's provenance from two history reads: one over the relation
 * nodes — the first revision's author drafted the reason, the authors of
 * revisions whose reason differs from the one before edited it — and one
 * over the groups those revisions were staged in, where the author of the
 * revision that first records the relation accepted, or first turns the
 * group accepted as a whole, is its confirmer. Established or candidate,
 * the read is the same; a relation declared directly carries no group and
 * no confirmer. BO_0247_007
 */
/**
 * A node's revisions oldest first, from a history read. The read lists the
 * current revision among the prior ones and may answer an archived revision
 * in the current slot once the node's established revision came from an
 * accepted candidate, and a revision's `dataRevision` moves when it is
 * archived — so revisions are taken once by id and ordered by the revision
 * they were created at, the read's own newest-first order as the tie-break
 * (found live in the `BO_0247` walk-through, 2026-09-14, when a relation's
 * drafter and editor came out swapped). BO_0247_007
 */
export function oldestFirst(node: { readonly revision: ReadNode["revision"]; readonly history?: readonly ReadNode["revision"][] }): ReadNode["revision"][] {
  const listed = [node.revision, ...(node.history ?? [])];
  const seen = new Set<string>();
  const unique: { revision: ReadNode["revision"]; position: number }[] = [];
  listed.forEach((revision, position) => {
    if (seen.has(revision.id)) return;
    seen.add(revision.id);
    unique.push({ revision, position });
  });
  const at = (revision: ReadNode["revision"]): number => revision.createdDataRevision ?? revision.dataRevision;
  unique.sort((left, right) => at(left.revision) - at(right.revision) || right.position - left.position);
  return unique.map((entry) => entry.revision);
}

export async function relationProvenanceOf(
  relationRefs: readonly string[],
): Promise<GraphOutcome<ReadonlyMap<string, RelationProvenance>>> {
  const out = new Map<string, RelationProvenance>();
  if (relationRefs.length === 0) return { outcome: "success", result: out };
  const history = await query({
    statement: "MATCH (r) RETURN GRAPH r INCLUDE HISTORY",
    roots: [...relationRefs].sort(),
    unbounded: true,
    purpose: "relation provenance",
  });
  if (history.outcome === "noResult") return { outcome: "success", result: out };
  if (history.outcome !== "success") return history as GraphOutcome<never>;
  const partial = new Map<string, { origin: string; draftedBy: string; editedBy: string[]; group: string | null }>();
  for (const node of history.result.nodes) {
    if (!relationRefs.includes(node.id)) continue;
    const revisions = oldestFirst(node);
    const first = revisions[0];
    if (first === undefined) continue;
    const editedBy: string[] = [];
    let previous = reasonText(first.content);
    for (const revision of revisions.slice(1)) {
      const reason = reasonText(revision.content);
      if (reason !== previous && editedBy[editedBy.length - 1] !== revision.createdBy) editedBy.push(revision.createdBy);
      previous = reason;
    }
    const group = revisions.map((revision) => revision.content?.[PROPOSAL_KEY]).find((value) => typeof value === "string" && value !== "");
    const origin = contentOf(node)["origin"];
    partial.set(node.id, { origin: typeof origin === "string" ? origin : "", draftedBy: first.createdBy, editedBy, group: typeof group === "string" ? group : null });
  }
  const groups = [...new Set([...partial.values()].map((entry) => entry.group).filter((group): group is string => group !== null))].sort();
  const confirmers = new Map<string, Map<string, string>>();
  const wholeGroup = new Map<string, string>();
  if (groups.length > 0) {
    const read = await query({
      statement: "MATCH (g) RETURN GRAPH g INCLUDE HISTORY",
      roots: groups,
      unbounded: true,
      purpose: "relation confirmers",
    });
    if (read.outcome !== "success" && read.outcome !== "noResult") return read as GraphOutcome<never>;
    for (const node of read.outcome === "success" ? read.result.nodes : []) {
      if (!groups.includes(node.id)) continue;
      const revisions = oldestFirst(node);
      const byMember = new Map<string, string>();
      for (const revision of revisions) {
        const decisions = revision.content?.[MEMBER_DECISIONS_KEY];
        if (decisions !== null && typeof decisions === "object") {
          for (const [member, decision] of Object.entries(decisions as Record<string, unknown>)) {
            if (decision === "accepted" && !byMember.has(member)) byMember.set(member, revision.createdBy);
          }
        }
        if (revision.content?.["status"] === "accepted" && !wholeGroup.has(node.id)) wholeGroup.set(node.id, revision.createdBy);
      }
      confirmers.set(node.id, byMember);
    }
  }
  for (const [ref, entry] of partial) {
    const confirmedBy = entry.group === null ? null : (confirmers.get(entry.group)?.get(ref) ?? wholeGroup.get(entry.group) ?? null);
    out.set(ref, { origin: entry.origin, draftedBy: entry.draftedBy, editedBy: entry.editedBy, confirmedBy });
  }
  return { outcome: "success", result: out };
}

const reasonText = (content: Record<string, unknown> | undefined): string =>
  runsOf(content?.["reason"]).map((run) => run.text).join("");

/**
 * A block's provenance: its revision history read metadata-only with
 * `INCLUDE HISTORY`, and its `derivedFrom` edges — on request, for the depth
 * the editor draws, never on the document read (`BO_0244_009`).
 */
export async function provenanceRead(blockId: string): Promise<GraphOutcome<BlockProvenance>> {
  const ref = nodeRef(blockId);
  const history = await query({
    statement: "MATCH (b) RETURN GRAPH b INCLUDE HISTORY",
    roots: [ref],
    metadataOnly: true,
    unbounded: true,
    purpose: "block provenance",
  });
  if (history.outcome !== "success" && history.outcome !== "noResult") return history as GraphOutcome<never>;
  const node = history.outcome === "success" ? history.result.nodes.find((candidate) => candidate.id === ref) : undefined;
  const derived = await rooted(`MATCH (b)-[e:${DERIVED_FROM}]->(f) RETURN GRAPH b, e, f ROOT b`, [ref], "derivations");
  if (derived.outcome !== "success") return derived as GraphOutcome<never>;
  const derivedFrom = derived.result.relations
    .filter((relation) => relation.type === DERIVED_FROM && relation.validity.status !== "closed" && relation.fromNodeId === ref)
    .map((relation) => bareId(relation.to.nodeId ?? ""))
    .filter((id) => id !== "")
    .sort();
  const revisions = node === undefined ? [] : [node.revision, ...(node.history ?? [])];
  return {
    outcome: "success",
    result: { blockId, provenance: provenanceOf(revisions, derivedFrom.length > 0), derivedFrom },
  };
}

/** One revision of a claim, as the history layer lists them. */
export interface ClaimRevision {
  readonly revisionId: string;
  readonly status: string;
  readonly createdBy: string;
  readonly createdAt: number;
  readonly text: readonly Run[];
}

export interface BlockHistory {
  readonly blockId: string;
  readonly claims: readonly { readonly claimId: string; readonly revisions: readonly ClaimRevision[] }[];
  /** The block's previous established words, for a derived block's
   * before/after — null when the block has had one revision. BO_0246_009 */
  readonly previous: readonly Run[] | null;
}

/**
 * The revisions of a block's claims, newest first: a rooted `INCLUDE
 * HISTORY` read of the claims, on request for the depth's *History* layer
 * and never on the document read (`CA_0046_003`).
 */
export async function historyRead(blockId: string): Promise<GraphOutcome<BlockHistory>> {
  const previous = await previousWords(blockId);
  const claims = await readClaims([blockId]);
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const refs = [...claims.result.blockOf.keys()];
  if (refs.length === 0) return { outcome: "success", result: { blockId, claims: [], previous } };
  const read = await query({
    statement: "MATCH (c) RETURN GRAPH c INCLUDE HISTORY",
    roots: refs,
    unbounded: true,
    purpose: "claim history",
  });
  if (read.outcome !== "success" && read.outcome !== "noResult") return read as GraphOutcome<never>;
  const nodes = new Map((read.outcome === "success" ? read.result.nodes : []).map((node) => [node.id, node]));
  const revisionOf = (revision: { id: string; status: string; createdBy: string; createdAt: number; content?: Record<string, unknown> }): ClaimRevision => ({
    revisionId: revision.id,
    status: revision.status,
    createdBy: revision.createdBy,
    createdAt: revision.createdAt,
    text: runsOf(revision.content?.["text"]),
  });
  return {
    outcome: "success",
    result: {
      blockId,
      previous,
      claims: refs.map((ref) => {
        const node = nodes.get(ref);
        return {
          claimId: bareId(ref),
          revisions: node === undefined ? [] : [node.revision, ...(node.history ?? [])].map(revisionOf),
        };
      }),
    },
  };
}

/** The words a block's previous established revision held, from its history:
 * the newest revision before the current one that was established, or null
 * when there is none. BO_0246_009 */
async function previousWords(blockId: string): Promise<readonly Run[] | null> {
  const read = await query({
    statement: "MATCH (b) RETURN GRAPH b INCLUDE HISTORY",
    roots: [nodeRef(blockId)],
    purpose: "previous framing",
  });
  if (read.outcome !== "success") return null;
  const node = read.result.nodes.find((candidate) => candidate.id === nodeRef(blockId));
  const earlier = (node?.history ?? []).find((revision) => revision.status !== "rejected" && revision.content?.["runs"] !== undefined);
  return earlier === undefined ? null : runsOf(earlier.content?.["runs"]);
}

/** One end of a relation as a caller names it: a claim, or a block whose one
 * claim is meant, or a block with the words of a claim to draft. */
export type RelationEndInput =
  | { readonly claimId: string }
  | { readonly blockId: string; readonly claim?: readonly Run[] };

export interface RelationInput {
  readonly kind: RelationKind;
  readonly reason: readonly Run[];
  readonly origin?: RelationOrigin;
  readonly source: RelationEndInput;
  readonly target: RelationEndInput;
}

/**
 * The statements that create a claim asserted by a block. Alias-scoped
 * parameters, as every script here writes them.
 */
export function draftClaimScript(
  alias: string,
  blockId: string,
  text: readonly Run[],
  parameters: Record<string, unknown>,
  established: boolean,
): { readonly claimId: string; readonly statements: readonly string[] } {
  const claimId = randomUUID();
  parameters[`${alias}c_id`] = claimId;
  parameters[`${alias}c_text`] = normalizeRuns([...text]);
  parameters[`${alias}cb`] = nodeRef(blockId);
  parameters[`${alias}cc`] = nodeRef(claimId);
  const status = established ? `, status: "established"` : "";
  return {
    claimId,
    statements: [
      `CREATE (${alias}c:${CLAIM_TYPE} {id: $${alias}c_id, text: $${alias}c_text${status}})`,
      `RELATE ${alias}cb -[${alias}ca:${ASSERTS}]-> ${alias}cc`,
    ],
  };
}

/** The statements that create a relation node between two claims. */
export function relationScript(
  alias: string,
  relation: { readonly kind: string; readonly reason: readonly Run[]; readonly origin: string },
  sourceClaimId: string,
  targetClaimId: string,
  parameters: Record<string, unknown>,
  established: boolean,
): { readonly relationId: string; readonly statements: readonly string[] } {
  const relationId = randomUUID();
  parameters[`${alias}_id`] = relationId;
  parameters[`${alias}_kind`] = relation.kind;
  parameters[`${alias}_reason`] = normalizeRuns([...relation.reason]);
  parameters[`${alias}_origin`] = relation.origin;
  parameters[`${alias}rs`] = nodeRef(relationId);
  parameters[`${alias}rt`] = nodeRef(relationId);
  parameters[`${alias}cs`] = nodeRef(sourceClaimId);
  parameters[`${alias}ct`] = nodeRef(targetClaimId);
  const status = established ? `, status: "established"` : "";
  return {
    relationId,
    statements: [
      `CREATE (${alias}:${RELATION_TYPE} {id: $${alias}_id, kind: $${alias}_kind, reason: $${alias}_reason, origin: $${alias}_origin${status}})`,
      `RELATE ${alias}rs -[${alias}es:${SOURCE}]-> ${alias}cs`,
      `RELATE ${alias}rt -[${alias}et:${TARGET}]-> ${alias}ct`,
    ],
  };
}

/**
 * A block another document holds, as a relation end may name one: it must
 * stand at head, be held by an active containment — a retired block holds no
 * anchor — and not be discarded. Answers its claims.
 */
export async function farBlock(
  blockId: string,
): Promise<GraphOutcome<{ readonly claims: readonly ClaimView[] }>> {
  const ref = nodeRef(blockId);
  const held = await rooted(`MATCH (d:${DOCUMENT_TYPE})-[k:${CONTAINS}]->(b) RETURN GRAPH d, k, b ROOT b`, [ref], "relation end");
  if (held.outcome !== "success") return held as GraphOutcome<never>;
  const node = held.result.nodes.find((candidate) => candidate.id === ref);
  if (node === undefined) {
    return { outcome: "noResult", detail: `Block ${blockId} is not in the graph.` };
  }
  const contained = held.result.relations.some(
    (relation) => relation.type === CONTAINS && relation.validity.status === "active" && relation.to.nodeId === ref,
  );
  if (!contained) {
    return { outcome: "validationFailure", failures: [{ operation: null, rule: "retiredBlock", detail: `Block ${blockId} is retired; a relation never anchors on a retired block.` }] };
  }
  if (contentOf(node)["disposition"] === "discarded") {
    return { outcome: "validationFailure", failures: [{ operation: null, rule: "discardedBlock", detail: `Block ${blockId} is discarded; a relation never anchors on a discarded block.` }] };
  }
  const claims = await readClaims([blockId]);
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  return { outcome: "success", result: { claims: claims.result.byBlock[blockId] ?? [] } };
}

/** Whether two blocks differ only in their kind. */
export const onlyKindDiffers = (left: BlockView, right: BlockView): boolean =>
  left.kind === "text" &&
  right.kind === "text" &&
  left.order === right.order &&
  left.role === right.role &&
  sameRuns(left.runs, right.runs) &&
  (left.blockKind ?? "") !== (right.blockKind ?? "");
