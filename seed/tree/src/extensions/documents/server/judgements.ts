import { randomUUID } from "node:crypto";

import {
  classificationOf,
  documentStateOf,
  isChangeOutcome,
  marksAtRest,
  unresolvedPressure,
  type DocumentState,
  type Judgement,
} from "~/extensions/documents/lib/judgements";
import { normalizeRuns, type Run } from "~/lib/runs";
import { query, type ReadNode, type ReadResult } from "~/server/ccgw/client";
import { commit, one } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";
import { readSession } from "~/server/session";
import { CONTAINS, type DocumentView } from "./assemble";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { readDocument } from "./documents";
import { DOCUMENT_TYPE } from "./vocabulary";
import { oldestFirst, type DocumentRelations } from "./work";

/**
 * The judgements on a document (`BO_0248_010`): what the system's runs
 * recorded about its blocks and relations — an edit's class, the pressure a
 * change put on a dependent block, a silence — read from the graph on
 * request and derived here into what the surfaces draw: the unresolved
 * pressure per block with its source premise before and after, the
 * document's derived state, and the flattened judgements the editor
 * derives classification, records and history from with the same pure
 * rules (`lib/judgements.ts`). Nothing is stored beside the judgements;
 * the reader's two writes are `resolveJudgement` (*Seen*, `BO_0248_008`)
 * and `classify` (a correction, `BO_0248_009`).
 */

export const JUDGEMENT_TYPE = "judgement";
export const JUDGES = "judges";

/** One unresolved pressure judgement on a block, as the pressure layer draws it. */
export interface PressureView {
  readonly judgementId: string;
  readonly relationId: string;
  readonly outcome: string;
  readonly explanation: readonly Run[];
  readonly dataRevision: number;
  readonly recordedAt: number;
  readonly run: string | null;
  /** Whether the block carries a marker at rest for it. */
  readonly atRest: boolean;
  /** The source premise: where it is and what it said before and after the change. */
  readonly source: {
    readonly blockId: string;
    readonly documentId: string;
    readonly documentTitle: string;
    readonly before: readonly Run[];
    readonly after: readonly Run[];
  };
  /** The relation's kind and origin, for *declared relation*. */
  readonly relation: { readonly kind: string; readonly origin: string; readonly reason: readonly Run[] };
}

export interface DocumentJudgements {
  readonly documentId: string;
  /** Every judgement on the document's blocks and relations, newest first. */
  readonly judgements: readonly Judgement[];
  /** Unresolved pressure by target block, newest first. */
  readonly pressure: Readonly<Record<string, readonly PressureView[]>>;
  /** The document's derived state: needs review, under pressure, or neither. */
  readonly state: DocumentState;
}

const runsOf = (value: unknown): readonly Run[] => (Array.isArray(value) ? normalizeRuns(value as readonly Run[]) : []);
const stringOr = (value: unknown, fallback: string): string => (typeof value === "string" ? value : fallback);
const stringOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/** A rooted read that answers empty rather than a refusal when nothing is reached. */
async function rooted(statement: string, roots: readonly string[], purpose: string): Promise<GraphOutcome<ReadResult>> {
  if (roots.length === 0) return { outcome: "success", result: { roots: [], nodes: [], relations: [], resolvedDataRevision: 0 } };
  const outcome = await query({ statement, roots: [...roots].sort(), unbounded: true, purpose });
  if (outcome.outcome === "noResult") return { outcome: "success", result: { roots: [], nodes: [], relations: [], resolvedDataRevision: 0 } };
  return outcome;
}

/**
 * The judgements in a read, flattened: each judgement's subject is the
 * relation it judges when it judges one, else the block; a pressure
 * judgement's target is its `target` property, or its block edge beside the
 * relation. Judgements whose every edge leaves the given refs are dropped,
 * so a read seeded at one document never carries another's.
 */
function judgementsIn(read: ReadResult, kinds: ReadonlyMap<string, "block" | "relation">): Judgement[] {
  const nodes = new Map<string, ReadNode>();
  for (const node of read.nodes) {
    if (typeOf(node) === JUDGEMENT_TYPE && node.revision.status === "established") nodes.set(node.id, node);
  }
  const edges = new Map<string, { relation: string | null; block: string | null }>();
  for (const edge of read.relations) {
    if (edge.type !== JUDGES || edge.validity.status !== "active" || edge.to.nodeId === undefined) continue;
    if (!nodes.has(edge.fromNodeId)) continue;
    const kind = kinds.get(edge.to.nodeId);
    if (kind === undefined) continue;
    const pair = edges.get(edge.fromNodeId) ?? { relation: null, block: null };
    if (kind === "relation") pair.relation = bareId(edge.to.nodeId);
    else pair.block = bareId(edge.to.nodeId);
    edges.set(edge.fromNodeId, pair);
  }
  const out: Judgement[] = [];
  for (const [ref, pair] of edges) {
    const node = nodes.get(ref) as ReadNode;
    const content = contentOf(node);
    const subject = pair.relation ?? pair.block;
    if (subject === null) continue;
    const declaredTarget = stringOrNull(content["target"]);
    const target = declaredTarget ?? (pair.relation !== null ? pair.block : null);
    out.push({
      judgementId: bareId(node.id),
      about: stringOr(content["about"], ""),
      outcome: stringOr(content["outcome"], ""),
      explanation: runsOf(content["explanation"]),
      dataRevision: typeof content["dataRevision"] === "number" ? content["dataRevision"] : Number(content["dataRevision"] ?? 0) || 0,
      recordedAt: node.revision.createdAt,
      run: stringOrNull(content["run"]),
      by: node.revision.createdBy,
      subject,
      target,
      resolves: stringOrNull(content["resolves"]),
      resolved: stringOrNull(content["resolved"]),
    });
  }
  return out.sort((left, right) => right.dataRevision - left.dataRevision || (left.judgementId < right.judgementId ? -1 : 1));
}

/**
 * The judgements on a document's blocks and relations: one reverse-rooted
 * read over `judges` seeded at both, then one history read of the source
 * claims the unresolved pressure names, for the premise before and after —
 * the newest revision created at or before the judgement's data revision is
 * *after*, the one before it *before*. BO_0248_010
 */
export async function judgementsOf(document: DocumentView, relations: DocumentRelations): Promise<GraphOutcome<DocumentJudgements>> {
  const kinds = new Map<string, "block" | "relation">();
  // The document itself is a subject too: a threshold judgement judges the
  // root alone and names no block. Its subject reads as the document id.
  kinds.set(nodeRef(document.documentId), "block");
  for (const block of document.blocks) kinds.set(nodeRef(block.blockId), "block");
  for (const relation of relations.relations) kinds.set(nodeRef(relation.relationId), "relation");
  const read = await rooted(`MATCH (j:${JUDGEMENT_TYPE})-[e:${JUDGES}]->(x) RETURN GRAPH j, e, x ROOT x`, [...kinds.keys()], "judgements read");
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const judgements = judgementsIn(read.result, kinds);

  const pressure: Record<string, PressureView[]> = {};
  const wanted: Judgement[] = [];
  for (const block of document.blocks) {
    const standing = unresolvedPressure(judgements, block.blockId);
    if (standing.length > 0) wanted.push(...standing);
  }
  const relationOf = (id: string) => relations.relations.find((relation) => relation.relationId === id);
  const claimRefs = [...new Set(wanted.map((judgement) => relationOf(judgement.subject)?.source.claimId).filter((id): id is string => id !== undefined))].map(nodeRef);
  const history = claimRefs.length === 0 ? null : await query({ statement: "MATCH (c) RETURN GRAPH c INCLUDE HISTORY", roots: claimRefs.sort(), unbounded: true, purpose: "pressure source history" });
  if (history !== null && history.outcome !== "success" && history.outcome !== "noResult") return history as GraphOutcome<never>;
  const claims = new Map((history?.outcome === "success" ? history.result.nodes : []).map((node) => [node.id, node]));
  const wordsAround = (claimId: string, dataRevision: number): { before: readonly Run[]; after: readonly Run[] } => {
    const node = claims.get(nodeRef(claimId));
    if (node === undefined) return { before: [], after: [] };
    const revisions = oldestFirst(node).filter((revision) => revision.status === "established" || revision.status === "archived");
    const at = (revision: ReadNode["revision"]): number => revision.createdDataRevision ?? revision.dataRevision;
    let index = -1;
    revisions.forEach((revision, position) => {
      if (at(revision) <= dataRevision) index = position;
    });
    if (index < 0) index = revisions.length - 1;
    const after = revisions[index];
    const before = index > 0 ? revisions[index - 1] : undefined;
    return { before: runsOf(before?.content?.["text"]), after: runsOf(after?.content?.["text"]) };
  };
  for (const judgement of wanted) {
    const relation = relationOf(judgement.subject);
    const target = judgement.target as string;
    (pressure[target] ??= []).push({
      judgementId: judgement.judgementId,
      relationId: judgement.subject,
      outcome: judgement.outcome,
      explanation: judgement.explanation,
      dataRevision: judgement.dataRevision,
      recordedAt: judgement.recordedAt,
      run: judgement.run,
      atRest: marksAtRest(judgement.outcome),
      source: {
        blockId: relation?.source.blockId ?? "",
        documentId: relation?.source.documentId ?? "",
        documentTitle: relation?.source.documentTitle ?? "",
        ...(relation === undefined ? { before: [], after: [] } : wordsAround(relation.source.claimId, judgement.dataRevision)),
      },
      relation: { kind: relation?.kind ?? "", origin: relation?.origin ?? "", reason: relation?.reason ?? [] },
    });
  }
  const byBlock: Record<string, readonly Judgement[]> = {};
  for (const [blockId, list] of Object.entries(pressure)) byBlock[blockId] = list.map((view) => judgements.find((judgement) => judgement.judgementId === view.judgementId) as Judgement);
  return { outcome: "success", result: { documentId: document.documentId, judgements, pressure, state: documentStateOf(byBlock) } };
}

/**
 * Every document's derived state, for the library's glyph: the unresolved
 * pressure judgements across the graph, their target blocks, and the
 * documents holding those blocks. Documents with neither state are absent.
 * BO_0248_012
 */
export async function documentStates(): Promise<GraphOutcome<Readonly<Record<string, Exclude<DocumentState, null>>>>> {
  const read = await query({ statement: `MATCH (j:${JUDGEMENT_TYPE})-[e:${JUDGES}]->(x) RETURN GRAPH j, e, x`, unbounded: true, purpose: "document states" });
  if (read.outcome === "noResult") return { outcome: "success", result: {} };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const kinds = new Map<string, "block" | "relation">();
  for (const node of read.result.nodes) {
    if (typeOf(node) === JUDGEMENT_TYPE) continue;
    kinds.set(node.id, typeOf(node) === "relation" ? "relation" : "block");
  }
  const judgements = judgementsIn(read.result, kinds);
  const targets = [...new Set(judgements.filter((judgement) => judgement.about === "pressure" && judgement.target !== null).map((judgement) => judgement.target as string))];
  const standing: Record<string, readonly Judgement[]> = {};
  for (const target of targets) {
    const list = unresolvedPressure(judgements, target);
    if (list.length > 0) standing[target] = list;
  }
  const blocks = Object.keys(standing);
  if (blocks.length === 0) return { outcome: "success", result: {} };
  const held = await rooted(`MATCH (d:${DOCUMENT_TYPE})-[c:${CONTAINS}]->(b) RETURN GRAPH d, c, b ROOT b`, blocks.map(nodeRef), "pressure documents");
  if (held.outcome !== "success") return held as GraphOutcome<never>;
  const documents = new Set(held.result.nodes.filter((node) => typeOf(node) === DOCUMENT_TYPE).map((node) => node.id));
  const byDocument: Record<string, Record<string, readonly Judgement[]>> = {};
  for (const edge of held.result.relations) {
    if (edge.type !== CONTAINS || edge.validity.status !== "active" || edge.to.nodeId === undefined || !documents.has(edge.fromNodeId)) continue;
    const blockId = bareId(edge.to.nodeId);
    if (standing[blockId] === undefined) continue;
    (byDocument[bareId(edge.fromNodeId)] ??= {})[blockId] = standing[blockId];
  }
  const out: Record<string, Exclude<DocumentState, null>> = {};
  for (const [documentId, pressure] of Object.entries(byDocument)) {
    const state = documentStateOf(pressure);
    if (state !== null) out[documentId] = state;
  }
  return { outcome: "success", result: out };
}

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({ outcome: "validationFailure", failures: [{ operation: null, rule, detail }] });

/**
 * *Seen*: the reader resolves a pressure judgement by revising its
 * `resolved` property as themselves — *<name> at <time>* — so it no longer
 * stands on its block while the judgement stays on record. BO_0248_008
 */
export async function resolveJudgement(input: { readonly judgementId: string }): Promise<GraphOutcome<{ readonly judgementId: string; readonly resolved: string; readonly dataRevision: string }>> {
  const person = await readSession();
  if (person === null) return refuse("noSession", "Seen is marked by a signed-in person.");
  const read = await one(input.judgementId, "judgement read");
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const node = read.result.nodes.find((candidate) => candidate.id === nodeRef(input.judgementId));
  if (node === undefined || typeOf(node) !== JUDGEMENT_TYPE) return refuse("unknownJudgement", `There is no judgement ${input.judgementId}.`);
  const resolved = `${person.name} at ${new Date().toISOString()}`;
  return commit(
    "SET j.resolved = $resolved",
    { jNodeId: nodeRef(input.judgementId), resolved },
    `mark judgement ${input.judgementId} seen`,
    async (dataRevision) => ({ judgementId: input.judgementId, resolved, dataRevision }),
  );
}

/**
 * A person's correction of an edit's classification: a `change` judgement
 * on the block recorded as theirs — no `run` — with the outcome they chose
 * and an explanation naming the class it corrects, so it is the block's
 * newest classification, the relation's record counts it, and the next
 * refinement re-evaluates what rested on the old class. BO_0248_009
 */
export async function classify(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly outcome: string;
  readonly explanation: readonly Run[];
}): Promise<GraphOutcome<{ readonly judgementId: string; readonly blockId: string; readonly dataRevision: string }>> {
  if (!isChangeOutcome(input.outcome)) return refuse("outcome", `A classification is one of reworded, clarified, narrowed, broadened or changed.`);
  const person = await readSession();
  if (person === null) return refuse("noSession", "A classification is corrected by a signed-in person.");
  const document = await readDocument(input.documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  if (!document.result.blocks.some((block) => block.blockId === input.blockId)) return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  const at = await one(input.blockId, "classification base");
  if (at.outcome !== "success") return at as GraphOutcome<never>;
  const judgementId = randomUUID();
  const explanation = input.explanation.length > 0 ? normalizeRuns([...input.explanation]) : [{ text: `Corrected by ${person.name}.` }];
  return commit(
    [
      `CREATE (j:${JUDGEMENT_TYPE} {id: $id, about: "change", outcome: $outcome, explanation: $explanation, dataRevision: $judgedAt, status: "established"})`,
      `RELATE jref -[e:${JUDGES}]-> bref`,
    ].join("; "),
    { id: judgementId, outcome: input.outcome, explanation, judgedAt: at.result.resolvedDataRevision, jref: nodeRef(judgementId), bref: nodeRef(input.blockId) },
    `classify block ${input.blockId} ${input.outcome}`,
    async (dataRevision) => ({ judgementId, blockId: input.blockId, dataRevision }),
  );
}

/** The classification a block carries, for the depth: the newest `change` judgement. */
export const classificationFor = classificationOf;
