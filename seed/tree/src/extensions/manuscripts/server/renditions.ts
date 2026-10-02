import { isBlobReference, objectIdOfHash } from "~/server/ccgw/blobs";
import { query, type ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

import { RENDITION_TYPE, isOutcome, isRenditionType, type RenditionFile, type RenditionView } from "../lib/rendition";

/**
 * The kept renditions (`calliopa-bootstrap`'s `BO_0312_021`): a document's,
 * read as one list, drawn at its end — and one by identity, for its files. A node this build
 * cannot read as a rendition is left out rather than drawn wrong.
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const words = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** One rendition as the graph holds it, or null. */
export function toRendition(node: ReadNode): RenditionView | null {
  const content = node.revision.content ?? {};
  if (content["_type"] !== RENDITION_TYPE) return null;
  const of = content["of"];
  const document = content["document"];
  const outcome = content["outcome"];
  const type = content["type"];
  if (typeof of !== "string" || typeof document !== "string" || !isOutcome(outcome) || !isRenditionType(type)) return null;
  const files: RenditionFile[] = [];
  for (const entry of Array.isArray(content["files"]) ? content["files"] : []) {
    if (!isBlobReference(entry)) continue;
    const objectId = objectIdOfHash(entry.hash);
    const filename = (entry as { filename?: unknown }).filename;
    if (objectId === null || typeof filename !== "string") continue;
    files.push({ objectId, filename, mediaType: entry.mediaType, size: entry.size });
  }
  return {
    renditionId: bareId(node.id),
    revisionId: node.revision.id,
    of,
    document,
    type,
    title: text(content["title"]),
    revision: typeof content["revision"] === "number" ? content["revision"] : 0,
    venue: text(content["venue"]),
    files,
    made: text(content["made"]),
    by: text(content["by"]),
    outcome,
    log: words(content["log"]),
    omitted: words(content["omitted"]),
  };
}

/** A document's kept renditions, newest first. */
export async function listRenditions(documentId: string): Promise<GraphOutcome<RenditionView[]>> {
  const found = await query({
    statement: `MATCH (r:${RENDITION_TYPE} {document: $document}) RETURN GRAPH r`,
    parameters: { document: documentId },
    unbounded: true,
    purpose: "renditions",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const listed = found.result.nodes
    .map(toRendition)
    .filter((rendition): rendition is RenditionView => rendition !== null && rendition.document === documentId);
  return { outcome: "success", result: listed.sort((left, right) => (left.made < right.made ? 1 : left.made > right.made ? -1 : 0)) };
}

/** One kept rendition, or a refusal naming it. */
export async function readRendition(renditionId: string): Promise<GraphOutcome<RenditionView>> {
  const found = await query({ statement: "MATCH (r) RETURN GRAPH r ROOT r", roots: [nodeRef(renditionId)], purpose: "rendition" });
  if (found.outcome === "noResult") return refuse("unknownRendition", `Rendition ${renditionId} is not kept here.`);
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const node = found.result.nodes.find((candidate) => candidate.id === nodeRef(renditionId));
  const rendition = node === undefined ? null : toRendition(node);
  if (rendition === null) return refuse("unknownRendition", `Rendition ${renditionId} is not kept here.`);
  return { outcome: "success", result: rendition };
}
