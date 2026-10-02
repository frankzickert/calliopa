interface ReachedRelation {
  readonly fromNodeId: string;
  readonly toId: string;
}

/**
 * Whether a proposal group's touched set reaches a document: a node it stages
 * a candidate of or intends to archive, or an end of a relation it stages or
 * closes, is one the document holds. `reach` is the document's node, its
 * blocks, the claims they assert and the relation nodes on those claims —
 * every node an item of the document's proposals read is drawn from. A group
 * that reaches none of them has nothing to answer here, and its members are
 * never read. BO_0257_008
 */
export const reachesDocument = (
  touched: {
    readonly touchedNodes: readonly string[];
    readonly stagedRelations: readonly ReachedRelation[];
    readonly closedRelations?: readonly ReachedRelation[];
  },
  reach: ReadonlySet<string>,
): boolean =>
  touched.touchedNodes.some((node) => reach.has(node)) ||
  [...touched.stagedRelations, ...(touched.closedRelations ?? [])].some(
    (relation) => reach.has(relation.fromNodeId) || reach.has(relation.toId),
  );

/** The shell's focused-work edge, from a child to the block it elaborates. */
export const FOCUSES = "focuses";

/**
 * A gather's moves, read from a group's touched set (`BO_0322`): the blocks
 * whose containment in the document the group closes and that it places
 * under another node, and that node — the focused work they move into. Null
 * when the group moves nothing out of the document. BO_0322_013
 */
export function gatherOf(
  touched: {
    readonly stagedRelations: readonly (ReachedRelation & { readonly type: string })[];
    readonly closedRelations?: readonly (ReachedRelation & { readonly type: string })[];
  },
  documentNode: string,
  established: ReadonlyMap<string, unknown>,
): { readonly moved: ReadonlySet<string>; readonly child: string } | null {
  const closed = new Set(
    (touched.closedRelations ?? [])
      .filter((relation) => relation.type === "CONTAINS" && relation.fromNodeId === documentNode && established.has(relation.toId))
      .map((relation) => relation.toId),
  );
  const moved = new Set<string>();
  let child = "";
  for (const relation of touched.stagedRelations) {
    if (relation.type === "CONTAINS" && relation.fromNodeId !== documentNode && closed.has(relation.toId)) {
      moved.add(relation.toId);
      child = relation.fromNodeId;
    }
  }
  return moved.size === 0 ? null : { moved, child };
}
