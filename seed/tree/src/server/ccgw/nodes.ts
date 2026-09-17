import type { ReadNode } from "./client";

/**
 * Reading a CCGW node: the four crossings between a stored revision and the
 * shapes any feature works in — a node reference, a bare identity, the
 * semantic type, and the content without the keys the core stamps into it —
 * beside `asRecord`, which says whether stored JSON is a record at all.
 *
 * They live here rather than in the document model because they are not the
 * document model: `publishing` and `calliopa-video` read nodes of their own
 * kinds with them, and an extension should not have to depend on `documents`
 * to read a node. BO_0255_007
 */

export const nodeRef = (id: string): string =>
  id.startsWith("node:") ? id : `node:${id}`;

export const bareId = (nodeId: string): string =>
  nodeId.startsWith("node:") ? nodeId.slice("node:".length) : nodeId;

/** The semantic type a CCGW revision carries, from its content or its metadata. */
export const typeOf = (node: ReadNode): string => {
  const content = node.revision.content;
  const stored = content === undefined ? node.revision.type : content["_type"];
  return typeof stored === "string" ? stored : "";
};

/** A revision's content without the reserved keys the core stamps into it. */
export function contentOf(node: ReadNode): Record<string, unknown> {
  const content = node.revision.content ?? {};
  const own: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (key.startsWith("_") || key === "id") continue;
    own[key] = value;
  }
  return own;
}

/** Stored content as a record, or null when it is not one. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
