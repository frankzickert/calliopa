import type { ChildFace, ChildPlan, FocusedWorkContribution } from "~/contract";
import type { Run } from "~/lib/runs";
import { query } from "~/server/ccgw/client";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { commit } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";

/**
 * Focused work: a block opened as its own work root is a child that
 * `focuses` it — an edge from the child to the block it elaborates. The
 * block keeps its place in its parent, the child is parentless in the
 * library's sense, and returning to the parent copies nothing: the parent
 * renders the child's current face on the block.
 *
 * The capability is the shell's (`CA_0065`, user decision 2026-09-23): what
 * it does is retarget a tab, push a route and land on a block, three things
 * the frame owns and no view may do for itself, and a reader must be able to
 * reach it on every install rather than only where some extension draws it.
 *
 * What the shell does not own is the vocabulary. `document`, `text` and
 * `contains` are `documents`', and only `focuses` is the shell's declaration,
 * so the child is made by the extension that contributes the target kind and
 * the shell commits its statements together with the edge in one script
 * (`FocusedWorkContribution`, `CA_0065_001`). A kind that contributes none
 * offers no focused work.
 *
 * CA_0065_002
 */

export const FOCUSES = "focuses";

/** What a block's focused work is, as the parent's face reads it. */
export interface FocusedChild {
  readonly itemId: string;
  readonly title: string;
  /** The words the child currently says for itself, when it says any. */
  readonly face: readonly Run[] | null;
}

/** Each block of a target that has focused work, by block identity. */
export type FocusedWork = Readonly<Record<string, FocusedChild>>;

export interface OpenedFocusedWork {
  readonly blockId: string;
  readonly itemId: string;
  readonly title: string;
  /** Whether this call created the child, or found the one that stood. */
  readonly created: boolean;
  readonly dataRevision: string;
}

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

/** What a kind that opens no focused work is answered with. */
const unsupported = <T>(kind: string): GraphOutcome<T> =>
  refuse("focusedWorkUnsupported", `A ${kind} does not open focused work.`);

/**
 * The contribution for a target kind, resolved when it is needed rather than
 * when this module loads. The server registry imports every extension's
 * server half, so a static import here would close a cycle through any
 * extension module that opens focused work — `documents`' own writes and
 * `calliopa-refine`'s reach both do, and the cycle leaves one extension's
 * contributions undefined while the registry is still being built. Technical
 * decision at implementation, 2026-09-23. CA_0065_002
 */
async function contributionFor(kind: string): Promise<FocusedWorkContribution | undefined> {
  const { focusedWorkFor } = await import("~/server/registry");
  return focusedWorkFor(kind);
}

/**
 * The children that focus the given blocks: one rooted read over `focuses`
 * seeded at the blocks by reverse propagation, answering each block's child
 * by identity and title.
 */
export async function childrenOf(
  kind: string,
  blockIds: readonly string[],
): Promise<GraphOutcome<Map<string, { readonly itemId: string; readonly title: string }>>> {
  const children = new Map<string, { itemId: string; title: string }>();
  if (blockIds.length === 0) return { outcome: "success", result: children };
  const contribution = await contributionFor(kind);
  if (contribution === undefined) return unsupported(kind);
  const childType = contribution.childType;
  const read = await query({
    statement: `MATCH (d:${childType})-[f:${FOCUSES}]->(b) RETURN GRAPH d, f, b ROOT b`,
    roots: blockIds.map(nodeRef),
    unbounded: true,
    purpose: "focused work",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: children };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const nodes = new Map(read.result.nodes.map((node) => [node.id, node]));
  for (const relation of read.result.relations) {
    if (relation.type !== FOCUSES || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    const child = nodes.get(relation.fromNodeId);
    if (child === undefined || typeOf(child) !== childType || child.revision.status !== "established") continue;
    const title = contentOf(child)["title"];
    children.set(bareId(relation.to.nodeId), {
      itemId: bareId(child.id),
      title: typeof title === "string" ? title : "",
    });
  }
  return { outcome: "success", result: children };
}

/**
 * The focused work of a target, each child with the face it wears on its
 * parent block: read on the first focus in a target, never on the target's
 * own read, so faces appear once any block is focused. Which blocks the
 * target holds is the extension's to answer. CA_0065_005
 */
export async function facesOf(kind: string, targetId: string): Promise<GraphOutcome<FocusedWork>> {
  const contribution = await contributionFor(kind);
  if (contribution === undefined) return unsupported(kind);
  const blocks = await contribution.blocksOf(targetId);
  if (blocks.outcome !== "success") return blocks as GraphOutcome<never>;
  const children = await childrenOf(kind, blocks.result);
  if (children.outcome !== "success") return children as GraphOutcome<never>;
  if (children.result.size === 0) return { outcome: "success", result: {} };
  const entries = [...children.result];
  const faces = await contribution.faces(entries.map(([, child]) => child.itemId));
  if (faces.outcome !== "success") return faces as GraphOutcome<never>;
  const byItem = new Map<string, ChildFace>(faces.result.map((face) => [face.itemId, face]));
  const work: Record<string, FocusedChild> = {};
  for (const [blockId, child] of entries) {
    const face = byItem.get(child.itemId);
    work[blockId] = { itemId: child.itemId, title: face?.title ?? child.title, face: face?.face ?? null };
  }
  return { outcome: "success", result: work };
}

/**
 * The one script that makes a block's focused work: the extension's own
 * statements for the child, then the `focuses` edge onto the block. The two
 * are never separate writes — a child without the edge is a document nothing
 * points at, and the edge cannot be written before the child exists. Pure, so
 * the composition is proven without a graph. CA_0065_002
 */
export function focusScript(
  plan: ChildPlan,
  blockId: string,
): { readonly statements: readonly string[]; readonly parameters: Readonly<Record<string, unknown>> } {
  return {
    statements: [...plan.statements, `RELATE fwChild -[f:${FOCUSES}]-> fwBlock`],
    parameters: { ...plan.parameters, fwChild: nodeRef(plan.itemId), fwBlock: nodeRef(blockId) },
  };
}

/**
 * Opens a block as focused work: the extension that owns the target kind
 * plans the child, and the shell commits that plan with the `focuses` edge
 * in one script — or answers the child that already focuses the block. A
 * human content write, confirmation-free. CA_0065_002
 */
export async function openFocusedWork(input: {
  readonly kind: string;
  readonly targetId: string;
  readonly blockId: string;
}): Promise<GraphOutcome<OpenedFocusedWork>> {
  const contribution = await contributionFor(input.kind);
  if (contribution === undefined) return unsupported(input.kind);
  const existing = await childrenOf(input.kind, [input.blockId]);
  if (existing.outcome !== "success") return existing as GraphOutcome<never>;
  const child = existing.result.get(input.blockId);
  if (child !== undefined) {
    return { outcome: "success", result: { blockId: input.blockId, ...child, created: false, dataRevision: "" } };
  }
  const planned = await contribution.plan({
    targetId: input.targetId,
    blockId: input.blockId,
  });
  if (planned.outcome !== "success") return planned as GraphOutcome<never>;
  const plan: ChildPlan = planned.result;
  const { statements, parameters } = focusScript(plan, input.blockId);
  return commit(
    statements.join("; "),
    parameters,
    `open block ${input.blockId} as focused work`,
    async (dataRevision) => ({
      blockId: input.blockId,
      itemId: plan.itemId,
      title: plan.title,
      created: true,
      dataRevision,
    }),
  );
}

/** The `focuses` edge a child holds, if it is focused work: its relation id
 * and the block it focuses, for the delete that closes it. */
export async function focusOf(
  kind: string,
  itemId: string,
): Promise<GraphOutcome<{ readonly relationId: string; readonly blockId: string } | null>> {
  const contribution = await contributionFor(kind);
  if (contribution === undefined) return unsupported(kind);
  const childType = contribution.childType;
  const read = await query({
    statement: `MATCH (d:${childType})-[f:${FOCUSES}]->(b) RETURN GRAPH d, f, b ROOT d`,
    roots: [nodeRef(itemId)],
    unbounded: true,
    purpose: "focus of a child",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: null };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const edge = read.result.relations.find(
    (relation) => relation.type === FOCUSES && relation.validity.status === "active" && relation.fromNodeId === nodeRef(itemId),
  );
  return {
    outcome: "success",
    result: edge === undefined || edge.to.nodeId === undefined ? null : { relationId: edge.id, blockId: bareId(edge.to.nodeId) },
  };
}
