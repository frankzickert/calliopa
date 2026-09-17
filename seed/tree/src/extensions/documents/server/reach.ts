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
