
/**
 * The boundary between stored JSON and the shapes this model works in.
 * `asRecord` is `src/server/ccgw/nodes.ts`'s, since reading stored JSON is
 * not a document's question (`BO_0255_007`).
 *
 * What the graph holds is JSON, not what a document's content means, so
 * reading a property off it or handing a built record back needs a crossing.
 * Both live here, once, rather than in every operation that touches content.
 */


/** A built record on its way into the graph. The vocabulary validates it, so
 * the crossing is checked by the write rather than trusted here. */
export function asContent(value: Record<string, unknown>): Record<string, unknown> {
  return value;
}
