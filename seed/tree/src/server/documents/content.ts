import type { JSONValue } from "postgres";

/**
 * The boundary between stored JSON and the shapes this model works in.
 *
 * `JSONValue` describes what Postgres will accept, not what a document's
 * content means, so reading a property off one or handing a built record back
 * needs a crossing. Both live here, once, rather than in every operation that
 * touches content.
 */

/** Stored content as a record, or null when it is not one. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A built record on its way into the graph. The vocabulary validates it, so
 * the crossing is checked by the write rather than trusted here. */
export function asContent(value: Record<string, unknown>): JSONValue {
  return value as JSONValue;
}
