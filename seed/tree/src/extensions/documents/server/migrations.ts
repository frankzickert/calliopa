import { query, type ReadNode, type ReadRelation } from "~/server/ccgw/client";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";
import { CONTAINS, RETIRED } from "./assemble";
import { DOCUMENT_TYPE } from "./vocabulary";
import { FOCUSES } from "./reach";
import { emptiedDocumentChild } from "./focus";

/**
 * `documents`' executable migrations (`calliopa-bootstrap`'s `BO_0312_001`):
 * the kernel posts `{pin, migration}` to a route here when it serves a pin
 * that carries the `ext.migration` member naming it, and writes the statement
 * answered as one truth change set under the instance's owner. Each is run
 * once per instance. BO_0315_008
 */

/** What a migration route answers: one script and its parameters, or an
 * empty statement when this instance has nothing to change. */
export interface MigrationStatement {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
}

/** The values the discarded standing was stored as: `discarded`, and the
 * `resolved` a block set aside before `BO_0272` narrowed the scale. */
export const RETIRED_STANDINGS = ["discarded", "resolved"] as const;

/** A block stored with a retired standing, and where it stands, if anywhere. */
export interface SetAside {
  readonly blockId: string;
  /** The containment it is drawn by, or null when it is retired already. */
  readonly containmentId: string | null;
  /** The document its reading order belongs to, which the retirement is
   * related from; null when it is retired already. */
  readonly documentId: string | null;
}

/**
 * The script that retires every block set aside and clears its standing: the
 * value first, since a relation anchors at the revision its end stands at,
 * then the containment closed and the block related `retired` from its
 * document, as a retirement from the bar does (`retireBlocks`). A block with
 * no containment left is retired already and only loses its value. Pure.
 */
export function retireSetAsideStatement(blocks: readonly SetAside[]): MigrationStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  blocks.forEach((block, index) => {
    const alias = `x${index}`;
    parameters[`${alias}NodeId`] = nodeRef(block.blockId);
    parameters[`${alias}standing`] = null;
    statements.push(`SET ${alias}.disposition = $${alias}standing`);
    if (block.containmentId === null || block.documentId === null) return;
    parameters[`c${index}RelationId`] = block.containmentId;
    parameters[`d${index}`] = nodeRef(block.documentId);
    statements.push(`CLOSE c${index}`, `RELATE d${index} -[r${index}:${RETIRED}]-> ${alias}`);
  });
  return { statement: statements.join("; "), parameters };
}

/**
 * Every text block stored as discarded or resolved, with the containment
 * that draws it and the document it is read in: a block in a callout is
 * drawn by the callout and read in the callout's document.
 */
export async function readSetAside(): Promise<GraphOutcome<readonly SetAside[]>> {
  const found = new Set<string>();
  for (const standing of RETIRED_STANDINGS) {
    const read = await query({
      statement: "MATCH (b:text {disposition: $standing}) RETURN GRAPH b",
      parameters: { standing },
      unbounded: true,
      purpose: "migration: blocks set aside",
    });
    if (read.outcome === "noResult") continue;
    if (read.outcome !== "success") return read as GraphOutcome<never>;
    for (const node of read.result.nodes) found.add(node.id);
  }
  if (found.size === 0) return { outcome: "success", result: [] };
  const holders = await query({
    statement: `MATCH (p)-[c:${CONTAINS}]->(b) RETURN GRAPH p, c, b ROOT b`,
    roots: [...found].sort(),
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: where the blocks set aside stand",
  });
  if (holders.outcome !== "success" && holders.outcome !== "noResult") return holders as GraphOutcome<never>;
  const nodes = holders.outcome === "success" ? holders.result.nodes : [];
  const relations = holders.outcome === "success" ? holders.result.relations : [];
  const typeOfNode = new Map(nodes.map((node) => [node.id, typeOf(node)] as const));
  const containing = new Map<string, { readonly relationId: string; readonly holder: string }>();
  for (const relation of relations) {
    if (relation.type !== CONTAINS || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    containing.set(relation.to.nodeId, { relationId: relation.id, holder: relation.fromNodeId });
  }
  const documentOf = new Map<string, string>();
  const callouts = [...new Set([...containing.values()].map((held) => held.holder).filter((holder) => typeOfNode.get(holder) !== DOCUMENT_TYPE))];
  if (callouts.length > 0) {
    const outer = await query({
      statement: `MATCH (d)-[c:${CONTAINS}]->(a) RETURN GRAPH d, c, a ROOT a`,
      roots: callouts.sort(),
      unbounded: true,
      metadataOnly: true,
      purpose: "migration: the documents callouts stand in",
    });
    if (outer.outcome !== "success" && outer.outcome !== "noResult") return outer as GraphOutcome<never>;
    for (const relation of outer.outcome === "success" ? outer.result.relations : []) {
      if (relation.type === CONTAINS && relation.validity.status === "active" && relation.to.nodeId !== undefined) documentOf.set(relation.to.nodeId, relation.fromNodeId);
    }
  }
  const bare = (id: string) => id.replace(/^node:/u, "");
  return {
    outcome: "success",
    result: [...found].sort().map((node) => {
      const held = containing.get(node);
      const document = held === undefined ? null : typeOfNode.get(held.holder) === DOCUMENT_TYPE ? held.holder : documentOf.get(held.holder) ?? null;
      return {
        blockId: bare(node),
        containmentId: held === undefined || document === null ? null : held.relationId,
        documentId: document === null ? null : bare(document),
      };
    }),
  };
}

/**
 * What refinement stored and `BO_0324` deletes with it (`BO_0324_Q1`,
 * `BO_0324_Q5`, `BO_0324_Q6`): properties to clear on the blocks and
 * documents that keep standing, relations to close, and nodes to retire.
 */
export interface Refinement {
  readonly clear: readonly { readonly nodeId: string; readonly properties: readonly string[] }[];
  readonly close: readonly string[];
  readonly retire: readonly string[];
}

/**
 * The script that deletes what refinement stored: the properties cleared
 * first, then every relation touching what goes closed, then the nodes
 * retired, so nothing is retired with a live relation still on it. Pure.
 */
export function retireRefinementStatement(found: Refinement): MigrationStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  found.clear.forEach((entry, index) => {
    const alias = `p${index}`;
    parameters[`${alias}NodeId`] = nodeRef(entry.nodeId);
    parameters[`${alias}none`] = null;
    statements.push(`SET ${entry.properties.map((property) => `${alias}.${property} = $${alias}none`).join(", ")}`);
  });
  found.close.forEach((relationId, index) => {
    parameters[`e${index}RelationId`] = relationId;
    statements.push(`CLOSE e${index}`);
  });
  found.retire.forEach((nodeId, index) => {
    parameters[`n${index}NodeId`] = nodeRef(nodeId);
    statements.push(`RETIRE n${index}`);
  });
  return { statement: statements.join("; "), parameters };
}

/** The value refinement's intention marked a block or a document with. */
const REFINE_INTENTION = "refine";
/** What refinement wrote on a document: the root's phase and its stamp. */
const PHASE_PROPERTIES = ["phase", "supersededBy", "acceptedAt"] as const;
/** The record an investigation document carries. RF_0003 */
const INVESTIGATION_RECORD = "investigation";

/** Every node of a type, content included; none when the type is not declared. */
async function nodesOfType(type: string, purpose: string): Promise<GraphOutcome<readonly ReadNode[]>> {
  const read = await query({ statement: `MATCH (n:${type}) RETURN GRAPH n`, unbounded: true, purpose });
  if (read.outcome === "noResult") return { outcome: "success", result: [] };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  return { outcome: "success", result: read.result.nodes.filter((node) => typeOf(node) === type) };
}

/** The active relations touching the given nodes, either way. */
async function relationsTouching(nodeIds: readonly string[], purpose: string): Promise<GraphOutcome<readonly ReadRelation[]>> {
  if (nodeIds.length === 0) return { outcome: "success", result: [] };
  const roots = nodeIds.map(nodeRef).sort();
  const found = new Map<string, ReadRelation>();
  for (const root of ["a", "b"] as const) {
    const read = await query({ statement: `MATCH (a)-[e]->(b) RETURN GRAPH a, e, b ROOT ${root}`, roots, unbounded: true, metadataOnly: true, purpose });
    if (read.outcome === "noResult") continue;
    if (read.outcome !== "success") return read as GraphOutcome<never>;
    for (const relation of read.result.relations) if (relation.validity.status === "active") found.set(relation.id, relation);
  }
  return { outcome: "success", result: [...found.values()] };
}

/**
 * What refinement stored on this instance: its claims and judgements and the
 * relations anchored on claims, with every relation touching them; the
 * investigation documents, with their `focuses` edge; every `derivedFrom`
 * edge; and the block kind, the root's phase and refinement's intention
 * written on what stays. A graph that never held refinement answers nothing,
 * and so does one this has already run on: a type no longer declared is
 * read as empty. BO_0324_010
 */
export async function readRefinement(): Promise<GraphOutcome<Refinement>> {
  const bare = (id: string) => id.replace(/^node:/u, "");
  const claims = await nodesOfType("claim", "migration: refinement's claims");
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const judgements = await nodesOfType("judgement", "migration: refinement's judgements");
  if (judgements.outcome !== "success") return judgements as GraphOutcome<never>;
  const claimIds = claims.result.map((node) => node.id);
  // The relations anchored on a claim are deleted with it (BO_0324_Q6).
  const anchored = claimIds.length === 0
    ? { outcome: "success" as const, result: [] as readonly ReadNode[] }
    : await (async (): Promise<GraphOutcome<readonly ReadNode[]>> => {
        const read = await query({ statement: "MATCH (r:relation)-[e]->(c) RETURN GRAPH r, e, c ROOT c", roots: [...claimIds].sort(), unbounded: true, metadataOnly: true, purpose: "migration: relations on claims" });
        if (read.outcome === "noResult") return { outcome: "success", result: [] };
        if (read.outcome !== "success") return read as GraphOutcome<never>;
        return { outcome: "success", result: read.result.nodes.filter((node) => typeOf(node) === "relation") };
      })();
  if (anchored.outcome !== "success") return anchored as GraphOutcome<never>;
  const documents = await nodesOfType(DOCUMENT_TYPE, "migration: documents refinement wrote on");
  if (documents.outcome !== "success") return documents as GraphOutcome<never>;
  const texts = await nodesOfType("text", "migration: blocks refinement wrote on");
  if (texts.outcome !== "success") return texts as GraphOutcome<never>;
  const derived = await query({ statement: "MATCH (b:text)-[e:derivedFrom]->(f) RETURN GRAPH b, e, f", unbounded: true, metadataOnly: true, purpose: "migration: derived blocks" });
  if (derived.outcome !== "success" && derived.outcome !== "noResult") return derived as GraphOutcome<never>;

  const investigations = documents.result.filter((node) => contentOf(node)["record"] === INVESTIGATION_RECORD).map((node) => node.id);
  const content = [...claimIds, ...judgements.result.map((node) => node.id), ...anchored.result.map((node) => node.id)];
  const touching = await relationsTouching(content.map(bare), "migration: what refinement's nodes relate");
  if (touching.outcome !== "success") return touching as GraphOutcome<never>;
  // An investigation goes as a deleted document does: its node retired and
  // its `focuses` edge closed, its blocks reachable through it alone.
  const focused = await relationsTouching(investigations.map(bare), "migration: investigations' focused work");
  if (focused.outcome !== "success") return focused as GraphOutcome<never>;

  const close = new Set<string>(touching.result.map((relation) => relation.id));
  for (const relation of focused.result) if (relation.type === FOCUSES) close.add(relation.id);
  for (const relation of derived.outcome === "success" ? derived.result.relations : []) {
    if (relation.type === "derivedFrom" && relation.validity.status === "active") close.add(relation.id);
  }
  const going = new Set([...content, ...investigations]);
  const clear: { nodeId: string; properties: string[] }[] = [];
  for (const node of [...documents.result, ...texts.result]) {
    if (going.has(node.id)) continue;
    const stored = contentOf(node);
    const properties: string[] = [];
    if (typeOf(node) === "text" && stored["kind"] !== undefined && stored["kind"] !== null) properties.push("kind");
    if (typeOf(node) === DOCUMENT_TYPE) for (const property of PHASE_PROPERTIES) if (stored[property] !== undefined && stored[property] !== null) properties.push(property);
    if (stored["intention"] === REFINE_INTENTION) properties.push("intention");
    if (properties.length > 0) clear.push({ nodeId: bare(node.id), properties });
  }
  return {
    outcome: "success",
    result: {
      clear: clear.sort((left, right) => (left.nodeId < right.nodeId ? -1 : 1)),
      close: [...close].sort(),
      retire: [...going].map(bare).sort(),
    },
  };
}

/** The properties a profile's generation setup was kept in before
 * `calliopa-bootstrap`'s `BO_0336`, which a format replaces. */
export const PROFILE_GENERATION_PROPERTIES = ["profileType", "imageBackend"] as const;

/**
 * The script that clears a profile's former generation setup from every
 * established document holding it (`BO_0336_040`): what a picture or a video
 * is made with is a format's now, and nothing of the setup moves to one — a
 * profile names a format by the person's choice. Empty when none holds it.
 */
export function clearProfileGenerationStatement(documents: readonly ReadNode[]): MigrationStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  documents
    .filter((node) => typeOf(node) === DOCUMENT_TYPE && node.revision.status === "established")
    .map((node) => ({ id: node.id, held: PROFILE_GENERATION_PROPERTIES.filter((property) => contentOf(node)[property] !== undefined) }))
    .filter((one) => one.held.length > 0)
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .forEach((one, index) => {
      parameters[`g${index}NodeId`] = one.id;
      statements.push(`SET ${one.held.map((property) => `g${index}.${property} = null`).join(", ")}`);
    });
  return { statement: statements.join("; "), parameters };
}

/** A focused work found empty, by the child and its `focuses` edge. */
export interface EmptyFocusedWork {
  readonly itemId: string;
  readonly relationId: string;
}

/**
 * The script that removes every focused work already empty when `CA_0083`
 * lands, as an emptying write would: each `focuses` edge closed first, then
 * each child retired. The parent blocks are left as they stand. Empty when
 * none is. Pure. CA_0083_003
 */
export function removeEmptyFocusedWorkStatement(found: readonly EmptyFocusedWork[]): MigrationStatement {
  const closes: string[] = [];
  const retires: string[] = [];
  const parameters: Record<string, unknown> = {};
  [...found]
    .sort((left, right) => (left.itemId < right.itemId ? -1 : 1))
    .forEach((one, index) => {
      parameters[`e${index}RelationId`] = one.relationId;
      parameters[`e${index}From`] = nodeRef(one.itemId);
      parameters[`g${index}NodeId`] = nodeRef(one.itemId);
      closes.push(`CLOSE e${index}`);
      retires.push(`RETIRE g${index}`);
    });
  return { statement: [...closes, ...retires].join("; "), parameters };
}

/**
 * Every focused work a document child holds that is empty in `CA_0083`'s
 * sense — no standing block and no pending insert — read through the
 * contribution's own rule, so the migration and an emptying write agree.
 */
export async function readEmptyFocusedWork(): Promise<GraphOutcome<readonly EmptyFocusedWork[]>> {
  const read = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE})-[f:${FOCUSES}]->(b) RETURN GRAPH d, f, b`,
    unbounded: true,
    purpose: "migration: empty focused work",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: [] };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const established = new Set(
    read.result.nodes.filter((node) => typeOf(node) === DOCUMENT_TYPE && node.revision.status === "established").map((node) => node.id),
  );
  const found: EmptyFocusedWork[] = [];
  for (const relation of read.result.relations) {
    if (relation.type !== FOCUSES || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    if (!established.has(relation.fromNodeId)) continue;
    const itemId = bareId(relation.fromNodeId);
    const emptied = await emptiedDocumentChild({ itemId, blockId: bareId(relation.to.nodeId) });
    if (emptied.outcome !== "success") return emptied as GraphOutcome<never>;
    if (emptied.result !== null) found.push({ itemId, relationId: relation.id });
  }
  return { outcome: "success", result: found };
}

/** The migrations this extension runs, by the route segment its member names. */
export const MIGRATIONS: Readonly<Record<string, () => Promise<GraphOutcome<MigrationStatement>>>> = {
  /** The discarded standing goes: every block set aside is retired. BO_0315_008 */
  "retire-discarded": async () => {
    const setAside = await readSetAside();
    if (setAside.outcome !== "success") return setAside as GraphOutcome<never>;
    return { outcome: "success", result: retireSetAsideStatement(setAside.result) };
  },
  /** Refinement leaves with what it stored. BO_0324_010 */
  "retire-refinement": async () => {
    const found = await readRefinement();
    if (found.outcome !== "success") return found as GraphOutcome<never>;
    return { outcome: "success", result: retireRefinementStatement(found.result) };
  },
  /** A focused work already empty goes; its parent block stays. CA_0083_003 */
  "remove-empty-focused-work": async () => {
    const found = await readEmptyFocusedWork();
    if (found.outcome !== "success") return found as GraphOutcome<never>;
    return { outcome: "success", result: removeEmptyFocusedWorkStatement(found.result) };
  },
  /** A profile's generation setup goes; a format holds it. BO_0336_040 */
  "profile-generation": async () => {
    const read = await query({ statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d`, unbounded: true, purpose: "documents holding a profile's generation setup" });
    if (read.outcome === "noResult") return { outcome: "success", result: { statement: "", parameters: {} } };
    if (read.outcome !== "success") return read as GraphOutcome<never>;
    return { outcome: "success", result: clearProfileGenerationStatement(read.result.nodes) };
  },
};
