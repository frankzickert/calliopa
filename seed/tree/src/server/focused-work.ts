import type { AdoptionPlan, ChildFace, ChildPlan, EmptiedKept, EmptiedPlan, FocusedWorkContribution } from "~/contract";
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
 * it does is open the child in a tab of its own, give it a route and land on
 * a block (`CA_0073`), things the frame owns and no view may do for itself,
 * and a reader must be able to reach it on every install rather than only
 * where some extension draws it.
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
  /** The first words of the child's blocks, when the kind answers them. BO_0349_019 */
  readonly lines?: readonly string[];
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
 * extension module that opens focused work — `documents`' own writes do —
 * and the cycle leaves one extension's
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
    work[blockId] = {
      itemId: child.itemId,
      title: face?.title ?? child.title,
      face: face?.face ?? null,
      ...(face?.lines === undefined ? {} : { lines: face.lines }),
    };
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
  /** A new child is made with no blocks: a nest puts the first one in. BO_0349_019 */
  readonly blank?: boolean;
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
    ...(input.blank === true ? { blank: true } : {}),
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

/** An empty focused work the shell removed: the child, the block it focused,
 * the target that block stands in, and what its kind kept for *Take back*.
 * CA_0083_001 */
export interface EmptiedFocusedWork {
  readonly itemId: string;
  readonly blockId: string;
  readonly parent: { readonly itemId: string; readonly title: string } | null;
  readonly kept: EmptiedKept;
  readonly dataRevision: string;
}

export interface AdoptedFocusedWork {
  /** The new block the adopted child now focuses. */
  readonly blockId: string;
  /** The target the block was made in: the one dropped on, or the focused
   * work of the block a nest landed on. */
  readonly targetId: string;
  readonly dataRevision: string;
}

/**
 * The script that removes an empty child: the kind's own statements, then the
 * `focuses` edge closed, so the parent block never points at a child that is
 * gone and the child never stands without the edge. Pure. CA_0083_001
 */
export function emptiedScript(
  plan: Pick<EmptiedPlan, "statements" | "parameters">,
  itemId: string,
  relationId: string,
): { readonly statements: readonly string[]; readonly parameters: Readonly<Record<string, unknown>> } {
  return {
    statements: [...plan.statements, "CLOSE fwEdge"],
    // The edge's origin, from where the kernel's gate reads the close.
    parameters: { ...plan.parameters, fwEdgeRelationId: relationId, fwEdgeFrom: nodeRef(itemId) },
  };
}

/**
 * Removes a focused work once it holds nothing: what counts as empty is the
 * kind's to say, a child that is not focused work or not empty is left as it
 * stands and answered `null`, and the parent block stays where it is. Called
 * after every write that can take the last block out of a child, never as a
 * gesture of its own (user decision, 2026-10-06). CA_0083_001
 */
export async function removeEmptyFocusedWork(
  kind: string,
  itemId: string,
): Promise<GraphOutcome<EmptiedFocusedWork | null>> {
  const contribution = await contributionFor(kind);
  if (contribution?.emptied === undefined) return { outcome: "success", result: null };
  const edge = await focusOf(kind, itemId);
  if (edge.outcome !== "success") return edge as GraphOutcome<never>;
  if (edge.result === null) return { outcome: "success", result: null };
  const { blockId, relationId } = edge.result;
  const planned = await contribution.emptied({ itemId, blockId });
  if (planned.outcome !== "success") return planned as GraphOutcome<never>;
  if (planned.result === null) return { outcome: "success", result: null };
  const plan = planned.result;
  const { statements, parameters } = emptiedScript(plan, itemId, relationId);
  return commit(
    statements.join("; "),
    parameters,
    `remove empty focused work ${itemId} of block ${blockId}`,
    async (dataRevision) => ({ itemId, blockId, parent: plan.parent, kept: plan.kept, dataRevision }),
  );
}

/**
 * Brings an emptied focused work back on the block it focused, from what its
 * kind kept: *Take back* (user decision, 2026-10-06). A block that has opened
 * focused work again since is refused in words rather than given a second
 * child. CA_0083_001
 */
export async function bringBackFocusedWork(input: {
  readonly kind: string;
  readonly blockId: string;
  readonly kept: EmptiedKept;
}): Promise<GraphOutcome<OpenedFocusedWork>> {
  const contribution = await contributionFor(input.kind);
  if (contribution?.bringBack === undefined) return unsupported(input.kind);
  const existing = await childrenOf(input.kind, [input.blockId]);
  if (existing.outcome !== "success") return existing as GraphOutcome<never>;
  const child = existing.result.get(input.blockId);
  if (child !== undefined) {
    return refuse("focusedWorkStands", `This block has focused work again, “${child.title}”.`);
  }
  const planned = await contribution.bringBack(input.kept);
  if (planned.outcome !== "success") return planned as GraphOutcome<never>;
  const plan = planned.result;
  const { statements, parameters } = focusScript(plan, input.blockId);
  return commit(
    statements.join("; "),
    parameters,
    `bring back focused work of block ${input.blockId}`,
    async (dataRevision) => ({ blockId: input.blockId, itemId: plan.itemId, title: plan.title, created: true, dataRevision }),
  );
}

/**
 * The one script that adopts an existing child as a new block's focused work:
 * the extension's statements making the block, the close of the `focuses`
 * edge the child held at another block, if any, and the edge onto the new
 * block. A child focuses one block, so it moves rather than doubling. Pure,
 * so the composition is proven without a graph. DO_0043_001
 */
export function adoptScript(
  plan: AdoptionPlan,
  childId: string,
  held: { readonly relationId: string } | null,
): { readonly statements: readonly string[]; readonly parameters: Readonly<Record<string, unknown>> } {
  const statements = [...plan.statements];
  const parameters: Record<string, unknown> = { ...plan.parameters };
  if (held !== null) {
    statements.push("CLOSE fwHeld");
    parameters["fwHeldRelationId"] = held.relationId;
    // The edge's origin, from where the kernel's gate reads the close.
    parameters["fwHeldFrom"] = nodeRef(childId);
  }
  statements.push(`RELATE fwChild -[f:${FOCUSES}]-> fwBlock`);
  parameters["fwChild"] = nodeRef(childId);
  parameters["fwBlock"] = nodeRef(plan.blockId);
  return { statements, parameters };
}

/**
 * Adopts an existing child as the focused work of a new block of a target —
 * the reverse of opening a block as focused work, a document dropped into a
 * document (`documents`' `DO_0043`, user decision 2026-10-06). The extension
 * owning the kind plans the block and says whether the drop is refused; the
 * shell closes the edge the child held and relates it to the new block, in
 * one script. With `into`, the drop landed on a block's middle: the drop is
 * checked against the target first, so a refused nest opens nothing, then the
 * block's focused work is opened blank, or found, and the new block lands at
 * its end. A human content write, confirmation-free. DO_0043_001
 */
export async function adoptFocusedWork(input: {
  readonly kind: string;
  readonly targetId: string;
  readonly childId: string;
  readonly placement?: unknown;
  readonly into?: string;
}): Promise<GraphOutcome<AdoptedFocusedWork>> {
  const contribution = await contributionFor(input.kind);
  if (contribution?.adopt === undefined) return unsupported(input.kind);
  let targetId = input.targetId;
  if (input.into !== undefined) {
    if (contribution.adoptable !== undefined) {
      const free = await contribution.adoptable({ targetId: input.targetId, childId: input.childId });
      if (free.outcome !== "success") return free as GraphOutcome<never>;
    }
    const opened = await openFocusedWork({ kind: input.kind, targetId: input.targetId, blockId: input.into, blank: true });
    if (opened.outcome !== "success") return opened as GraphOutcome<never>;
    targetId = opened.result.itemId;
  }
  const planned = await contribution.adopt({
    targetId,
    childId: input.childId,
    ...(input.into === undefined && input.placement !== undefined ? { placement: input.placement } : {}),
  });
  if (planned.outcome !== "success") return planned as GraphOutcome<never>;
  const held = await focusOf(input.kind, input.childId);
  if (held.outcome !== "success") return held as GraphOutcome<never>;
  const plan = planned.result;
  const { statements, parameters } = adoptScript(plan, input.childId, held.result);
  return commit(
    statements.join("; "),
    parameters,
    `adopt ${input.childId} as the focused work of a new block in ${targetId}`,
    async (dataRevision) => ({ blockId: plan.blockId, targetId, dataRevision }),
  );
}
