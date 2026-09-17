import { randomUUID } from "node:crypto";

import { orderBetween } from "~/lib/order";
import { runsText, type Run } from "~/lib/runs";
import { query } from "~/server/ccgw/client";
import { commit, properties } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";
import { CONTAINS, type BlockView, type DocumentView } from "./assemble";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { readDocument } from "./documents";
import { readClaims } from "./work";
import { DOCUMENT_TYPE } from "./vocabulary";

/**
 * Focused work (`CA_0047`): a block opened as its own work root is a
 * document that `focuses` it — an edge from the child document to the block
 * it elaborates. The block keeps its place in its parent, the child is
 * parentless in the library's sense, and returning to the parent copies
 * nothing: the parent renders the child's current synthesis as the block's
 * face. A block is focused by at most one document, the shell's rule,
 * checked by a read before the write as single containment is.
 */

export const FOCUSES = "focuses";

/** What a block's focused work is, as the parent's face reads it. */
export interface FocusedChild {
  readonly documentId: string;
  readonly title: string;
  /** The child's current synthesis, when it holds one. */
  readonly synthesis: readonly Run[] | null;
}

export type FocusedWork = Readonly<Record<string, FocusedChild>>;

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

/**
 * The documents that focus the given blocks: one rooted read over `focuses`
 * seeded at the blocks by reverse propagation, answering each block's child
 * by id and title.
 */
export async function childrenOf(
  blockIds: readonly string[],
): Promise<GraphOutcome<Map<string, { readonly documentId: string; readonly title: string }>>> {
  const children = new Map<string, { documentId: string; title: string }>();
  if (blockIds.length === 0) return { outcome: "success", result: children };
  const read = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE})-[f:${FOCUSES}]->(b) RETURN GRAPH d, f, b ROOT b`,
    roots: blockIds.map(nodeRef),
    unbounded: true,
    purpose: "focused work",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: children };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const nodes = new Map(read.result.nodes.map((node) => [node.id, node]));
  for (const relation of read.result.relations) {
    if (relation.type !== FOCUSES || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    const document = nodes.get(relation.fromNodeId);
    if (document === undefined || typeOf(document) !== DOCUMENT_TYPE || document.revision.status !== "established") continue;
    const title = contentOf(document)["title"];
    children.set(bareId(relation.to.nodeId), { documentId: bareId(document.id), title: typeof title === "string" ? title : "" });
  }
  return { outcome: "success", result: children };
}

/**
 * The focused work of a document's blocks, with each child's synthesis for
 * the parent's face: read with the relations on focus, never on the document
 * read (`CA_0047_005`).
 */
export async function focusedWorkOf(document: DocumentView): Promise<GraphOutcome<FocusedWork>> {
  const children = await childrenOf(document.blocks.map((block) => block.blockId));
  if (children.outcome !== "success") return children as GraphOutcome<never>;
  const work: Record<string, FocusedChild> = {};
  for (const [blockId, child] of children.result) {
    const read = await readDocument(child.documentId);
    const synthesis =
      read.outcome === "success"
        ? (read.result.blocks.find((block) => block.kind === "text" && block.blockKind === "synthesis") as (BlockView & { kind: "text" }) | undefined)
        : undefined;
    work[blockId] = { ...child, synthesis: synthesis === undefined ? null : synthesis.runs };
  }
  return { outcome: "success", result: work };
}

/** A child's title: the one claim the block asserts when it asserts exactly
 * one, else the block's words to the first sentence. User decision,
 * 2026-09-13. */
export function childTitle(blockWords: string, claims: readonly { readonly text: readonly Run[] }[]): string {
  if (claims.length === 1) {
    const claim = runsText(claims[0]?.text ?? []).trim();
    if (claim !== "") return claim;
  }
  const sentence = /^(.*?[.!?])(\s|$)/u.exec(blockWords.trim());
  const words = (sentence?.[1] ?? blockWords).trim();
  return words === "" ? "Focused work" : words;
}

export interface OpenedFocusedWork {
  readonly blockId: string;
  readonly documentId: string;
  readonly title: string;
  /** Whether this call created the child, or found the one that stood. */
  readonly created: boolean;
  readonly dataRevision: string;
}

/**
 * Opens a block as focused work: creates the child document with its first
 * block and the `focuses` edge in one script, or answers the child that
 * already focuses the block. A human content write, confirmation-free.
 * `CA_0047_002`
 */
export async function openFocusedWork(input: {
  readonly documentId: string;
  readonly blockId: string;
}): Promise<GraphOutcome<OpenedFocusedWork>> {
  const parent = await readDocument(input.documentId);
  if (parent.outcome !== "success") return parent as GraphOutcome<never>;
  const block = parent.result.blocks.find((candidate) => candidate.blockId === input.blockId);
  if (block === undefined) return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  if (block.kind !== "text") return refuse("blockKind", `A ${block.kind} block does not open as focused work.`);
  const existing = await childrenOf([input.blockId]);
  if (existing.outcome !== "success") return existing as GraphOutcome<never>;
  const child = existing.result.get(input.blockId);
  if (child !== undefined) {
    return { outcome: "success", result: { blockId: input.blockId, ...child, created: false, dataRevision: "" } };
  }
  const claims = await readClaims([input.blockId]);
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const title = childTitle(runsText(block.runs), claims.result.byBlock[input.blockId] ?? []);
  const documentId = randomUUID();
  const blockId = randomUUID();
  const parameters: Record<string, unknown> = {
    cd: nodeRef(documentId),
    cb: nodeRef(blockId),
    fd: nodeRef(documentId),
    fb: nodeRef(input.blockId),
  };
  const statements = [
    `CREATE (d:${DOCUMENT_TYPE} {${properties("d", { id: documentId, title }, parameters)}})`,
    `CREATE (b:text {${properties("b", { id: blockId, order: orderBetween("", ""), runs: [] }, parameters)}})`,
    `RELATE cd -[c:${CONTAINS}]-> cb`,
    `RELATE fd -[f:${FOCUSES}]-> fb`,
  ];
  return commit(statements.join("; "), parameters, `open block ${input.blockId} as focused work`, async (dataRevision) => ({
    blockId: input.blockId,
    documentId,
    title,
    created: true,
    dataRevision,
  }));
}

/** The `focuses` edge a document holds, if it is focused work: its relation
 * id and the block it focuses, for the delete that closes it. */
export async function focusOf(documentId: string): Promise<GraphOutcome<{ readonly relationId: string; readonly blockId: string } | null>> {
  const read = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE})-[f:${FOCUSES}]->(b) RETURN GRAPH d, f, b ROOT d`,
    roots: [nodeRef(documentId)],
    unbounded: true,
    purpose: "focus of a document",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: null };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const edge = read.result.relations.find(
    (relation) => relation.type === FOCUSES && relation.validity.status === "active" && relation.fromNodeId === nodeRef(documentId),
  );
  return {
    outcome: "success",
    result: edge === undefined || edge.to.nodeId === undefined ? null : { relationId: edge.id, blockId: bareId(edge.to.nodeId) },
  };
}
