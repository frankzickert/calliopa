import { createHash, randomUUID } from "node:crypto";

import { blobHash, blobReference, isBlobReference, putBlob } from "~/server/ccgw/blobs";
import type { ReadResult } from "~/server/ccgw/client";
import { createDocument } from "~/extensions/documents/server/documents";
import type { GraphOutcome } from "~/server/outcome";
import { CONTENT_CLASSES, type ContentClass } from "../lib/content-index";
import type { DeliverableSummary, ExportView, ItemSummary, ItemView } from "../lib/work";
import {
  activeRelation,
  activeSources,
  activeTargets,
  allOfType,
  close,
  commit,
  conflict,
  incoming,
  merge,
  nodeIn,
  nodesOfType,
  number,
  outgoing,
  properties,
  read,
  refuse,
  relate,
  retire,
  revise,
  text,
} from "./graph";
import { readMediaFacts } from "./media-facts";
import { liveAt } from "./releases";
import { DELIVERABLE_TYPE, EXPORT_TYPE, EXPORTED, GATHERS, ITEM_TYPE, PROSE, SHAPE_TYPE, SHAPED, aspectOf, type Provenance } from "./vocabulary";

/**
 * Items and their exports, and the ingest path. PU_0002_004
 *
 * An item is one piece of content: its class, its machine facts, a label, its
 * disclosure, and either its exports — one per rendition, each a CCGW blob —
 * or, for prose, its body document. Ingest reads the facts off the bytes
 * before anything is written, puts the blob immediately before the export
 * that references it, and refuses a file whose facts it cannot read with
 * nothing stored.
 */

export interface WrittenItem {
  readonly itemId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

/** The blob store's cap, as `binary-content.md` fixes its default; stated where an upload is refused. */
export const UPLOAD_CAP_BYTES = 100 * 1024 * 1024;

export const objectIdOf = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export function exportOf(content: Record<string, unknown>, exportId: string): ExportView | null {
  const bytes = content["bytes"];
  if (!isBlobReference(bytes)) return null;
  const width = number(content, "width");
  const height = number(content, "height");
  return {
    exportId,
    hash: bytes.hash,
    mediaType: bytes.mediaType,
    size: bytes.size,
    width,
    height,
    aspect: aspectOf(width, height),
    provenance: (text(content, "provenance") || "ingested") as Provenance,
  };
}

export function itemSummaryOf(content: Record<string, unknown>, itemId: string, exportCount: number): ItemSummary {
  return {
    itemId,
    class: (text(content, "class") || "file") as ContentClass,
    label: text(content, "label"),
    durationSeconds: number(content, "durationSeconds"),
    width: number(content, "width"),
    height: number(content, "height"),
    exportCount,
  };
}

/** The exports an item still exports, out of a read rooted at the item. */
export function exportsOf(graph: ReadResult, itemId: string): ExportView[] {
  return activeTargets(graph, itemId, EXPORTED)
    .map((exportId) => {
      const node = nodeIn(graph, exportId);
      return node === undefined ? null : exportOf(read(node).content, exportId);
    })
    .filter((found): found is ExportView => found !== null);
}

async function deliverableSummaries(ids: readonly string[]): Promise<GraphOutcome<DeliverableSummary[]>> {
  if (ids.length === 0) return { outcome: "success", result: [] };
  const outcome = await outgoing(ids);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<DeliverableSummary[]>;
  const shapes = await allOfType(SHAPE_TYPE, "shapes listing");
  if (shapes.outcome !== "success") return shapes as GraphOutcome<DeliverableSummary[]>;
  const titles = new Map(nodesOfType(shapes.result, SHAPE_TYPE).map((node) => [read(node).id, text(read(node).content, "title")]));
  return {
    outcome: "success",
    result: ids
      .map((deliverableId) => {
        const node = nodeIn(outcome.result, deliverableId);
        if (node === undefined) return null;
        const shapeId = activeTargets(outcome.result, deliverableId, SHAPED)[0] ?? "";
        return { deliverableId, title: text(read(node).content, "title"), shapeId, shapeTitle: titles.get(shapeId) ?? shapeId };
      })
      .filter((found): found is DeliverableSummary => found !== null),
  };
}

export async function readItem(itemId: string): Promise<GraphOutcome<ItemView>> {
  const [leaving, arriving] = await Promise.all([outgoing([itemId]), incoming([itemId])]);
  if (leaving.outcome !== "success") return leaving as GraphOutcome<ItemView>;
  if (arriving.outcome !== "success") return arriving as GraphOutcome<ItemView>;
  const graph = merge(leaving.result, arriving.result);
  const node = nodesOfType(graph, ITEM_TYPE).find((candidate) => read(candidate).id === itemId);
  if (node === undefined) return { outcome: "noResult", detail: `No item ${itemId} in this graph.` };
  const own = read(node);
  const exports = exportsOf(leaving.result, itemId);
  const gatheredBy = await deliverableSummaries(activeSources(arriving.result, itemId, GATHERS));
  if (gatheredBy.outcome !== "success") return gatheredBy as GraphOutcome<ItemView>;
  return {
    outcome: "success",
    result: {
      ...itemSummaryOf(own.content, itemId, exports.length),
      revisionId: own.revisionId,
      synthetic: own.content["synthetic"] === true,
      transcript: text(own.content, "transcript"),
      alt: text(own.content, "alt"),
      exports,
      documentId: activeTargets(leaving.result, itemId, PROSE)[0] ?? null,
      gatheredBy: gatheredBy.result,
    },
  };
}

/** Every item with its export count, and which of them nothing gathers. */
export async function listItems(): Promise<GraphOutcome<{ readonly items: readonly ItemSummary[]; readonly standing: readonly ItemSummary[] }>> {
  const all = await allOfType(ITEM_TYPE, "items listing");
  if (all.outcome !== "success") return all as GraphOutcome<never>;
  const ids = nodesOfType(all.result, ITEM_TYPE).map((node) => read(node).id);
  const [leaving, arriving] = await Promise.all([outgoing(ids), incoming(ids)]);
  if (leaving.outcome !== "success") return leaving as GraphOutcome<never>;
  if (arriving.outcome !== "success") return arriving as GraphOutcome<never>;
  const items = nodesOfType(all.result, ITEM_TYPE)
    .map((node) => itemSummaryOf(read(node).content, read(node).id, activeTargets(leaving.result, read(node).id, EXPORTED).length))
    .sort((left, right) => left.label.localeCompare(right.label));
  const standing = items.filter((item) => activeSources(arriving.result, item.itemId, GATHERS).length === 0);
  return { outcome: "success", result: { items, standing } };
}

export async function listStanding(): Promise<GraphOutcome<readonly ItemSummary[]>> {
  const outcome = await listItems();
  if (outcome.outcome !== "success") return outcome as GraphOutcome<readonly ItemSummary[]>;
  return { outcome: "success", result: outcome.result.standing };
}

/** The class a media type falls in, for an upload whose class was not named. */
export function classOfMediaType(mediaType: string): ContentClass {
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("audio/")) return "audio";
  return "file";
}

/**
 * The facts an upload states about itself, by the class it is ingested as: a
 * video needs an ISO base media file, an image a PNG or a JPEG, and audio or
 * a file is taken as it is with the media type the browser named.
 */
function factsFor(
  itemClass: ContentClass,
  bytes: Uint8Array,
  mediaType: string,
): GraphOutcome<{ readonly mediaType: string; readonly width: number | null; readonly height: number | null; readonly durationSeconds: number | null }> {
  if (itemClass === "prose") return refuse("proseIsADocument", "A prose item is written in the editor, not uploaded.");
  if (itemClass === "audio" || itemClass === "file") {
    return { outcome: "success", result: { mediaType: mediaType || "application/octet-stream", width: null, height: null, durationSeconds: null } };
  }
  const facts = readMediaFacts(bytes);
  if (!facts.ok) return refuse("unreadableMedia", facts.detail);
  const isVideo = facts.facts.durationSeconds !== undefined;
  if (itemClass === "video" && !isVideo) return refuse("notAVideo", "This file is a still picture, not a video.");
  if (itemClass === "image" && isVideo) return refuse("notAnImage", "This file is a video, not a still picture.");
  return {
    outcome: "success",
    result: {
      mediaType: facts.facts.contentType,
      width: facts.facts.width,
      height: facts.facts.height,
      durationSeconds: facts.facts.durationSeconds ?? null,
    },
  };
}

/** Puts the bytes in the blob store, answering the object id, or a refusal naming the cap. */
async function store(bytes: Uint8Array): Promise<GraphOutcome<string>> {
  if (bytes.byteLength > UPLOAD_CAP_BYTES) {
    return refuse("aboveTheCap", `This file is ${Math.round(bytes.byteLength / 1048576)} MiB; an upload is at most ${UPLOAD_CAP_BYTES / 1048576} MiB.`);
  }
  if (bytes.byteLength === 0) return refuse("emptyFile", "This file holds no bytes.");
  const objectId = objectIdOf(bytes);
  const uploaded = await putBlob(bytes);
  if (uploaded.outcome !== "success") return uploaded as GraphOutcome<string>;
  if (uploaded.result.hash !== blobHash(objectId)) {
    return { outcome: "storageError", detail: `CCGW hashed the upload as ${uploaded.result.hash}, not ${blobHash(objectId)}.` };
  }
  return { outcome: "success", result: objectId };
}

/**
 * A new item from a file: its class named, or taken from the media type; its
 * facts read off the bytes; the blob put; the item and its first export in
 * one script. PU_0002_004
 */
export async function ingestItem(input: {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly filename?: string | undefined;
  readonly class?: string | undefined;
  readonly label?: string | undefined;
  readonly synthetic?: boolean | undefined;
}): Promise<GraphOutcome<WrittenItem>> {
  const itemClass = (input.class ?? classOfMediaType(input.mediaType)) as ContentClass;
  if (!(CONTENT_CLASSES as readonly string[]).includes(itemClass)) return refuse("unknownClass", `${input.class} is not a content class.`);
  const facts = factsFor(itemClass, input.bytes, input.mediaType);
  if (facts.outcome !== "success") return facts as GraphOutcome<WrittenItem>;
  const stored = await store(input.bytes);
  if (stored.outcome !== "success") return stored as GraphOutcome<WrittenItem>;
  const itemId = randomUUID();
  const exportId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const label = (input.label ?? input.filename ?? "").trim();
  const item: Record<string, unknown> = {
    id: itemId,
    class: itemClass,
    label,
    synthetic: input.synthetic ?? false,
    ...(facts.result.durationSeconds === null ? {} : { durationSeconds: facts.result.durationSeconds }),
    ...(facts.result.width === null ? {} : { width: facts.result.width, height: facts.result.height }),
  };
  const found: Record<string, unknown> = {
    id: exportId,
    bytes: { ...blobReference(stored.result, facts.result.mediaType, input.bytes.byteLength), ...(input.filename === undefined ? {} : { filename: input.filename }) },
    mediaType: facts.result.mediaType,
    size: input.bytes.byteLength,
    ...(facts.result.width === null ? {} : { width: facts.result.width, height: facts.result.height }),
    provenance: "ingested",
  };
  const statements = [
    `CREATE (i:${ITEM_TYPE} {${properties("i", item, parameters)}})`,
    `CREATE (x:${EXPORT_TYPE} {${properties("x", found, parameters)}})`,
    relate("e", EXPORTED, itemId, exportId, parameters),
  ];
  return commit(statements.join("; "), parameters, `ingest item ${itemId}`, async (dataRevision, revisionOf) => ({
    itemId,
    revisionId: await revisionOf(itemId),
    dataRevision,
  }));
}

/** A new prose item: a shell document created for it and opened by the caller, related by `prose`. */
export async function createProseItem(input: { readonly label: string; readonly synthetic?: boolean }): Promise<GraphOutcome<WrittenItem & { readonly documentId: string }>> {
  const label = input.label.trim();
  if (label === "") return refuse("labelRequired", "A prose item needs a label, which titles its document.");
  const document = await createDocument({ title: label });
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const itemId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const statements = [
    `CREATE (i:${ITEM_TYPE} {${properties("i", { id: itemId, class: "prose", label, synthetic: input.synthetic ?? false }, parameters)}})`,
    relate("d", PROSE, itemId, document.result.documentId, parameters),
  ];
  return commit(statements.join("; "), parameters, `create prose item ${itemId}`, async (dataRevision, revisionOf) => ({
    itemId,
    revisionId: await revisionOf(itemId),
    dataRevision,
    documentId: document.result.documentId,
  }));
}

/**
 * A further export of an item, or a replacement: the old export stays, and
 * only the item's `exported` relation to it is closed in the same script.
 */
export async function addExport(input: {
  readonly itemId: string;
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly filename?: string | undefined;
  readonly replaces?: string | undefined;
}): Promise<GraphOutcome<{ readonly exportId: string; readonly dataRevision: string }>> {
  const existing = await readItem(input.itemId);
  if (existing.outcome !== "success") return existing as GraphOutcome<never>;
  if (existing.result.class === "prose") return refuse("proseIsADocument", "A prose item has a document, not exports.");
  const facts = factsFor(existing.result.class, input.bytes, input.mediaType);
  if (facts.outcome !== "success") return facts as GraphOutcome<never>;
  const stored = await store(input.bytes);
  if (stored.outcome !== "success") return stored as GraphOutcome<never>;
  const leaving = await outgoing([input.itemId]);
  if (leaving.outcome !== "success") return leaving as GraphOutcome<never>;
  const exportId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const found: Record<string, unknown> = {
    id: exportId,
    bytes: { ...blobReference(stored.result, facts.result.mediaType, input.bytes.byteLength), ...(input.filename === undefined ? {} : { filename: input.filename }) },
    mediaType: facts.result.mediaType,
    size: input.bytes.byteLength,
    ...(facts.result.width === null ? {} : { width: facts.result.width, height: facts.result.height }),
    provenance: "ingested",
  };
  const statements = [`CREATE (x:${EXPORT_TYPE} {${properties("x", found, parameters)}})`, relate("e", EXPORTED, input.itemId, exportId, parameters)];
  if (input.replaces !== undefined) {
    const relation = activeRelation(leaving.result, input.itemId, EXPORTED, input.replaces);
    if (relation === undefined) return refuse("unknownExport", `This item does not export ${input.replaces}.`);
    statements.push(close("o", relation.id, input.itemId, parameters));
  }
  return commit(statements.join("; "), parameters, `add export ${exportId} to item ${input.itemId}`, async (dataRevision) => ({
    exportId,
    dataRevision,
  }));
}

/** Sets an item's own words: its label, alt text, transcript and disclosure, each on its own. */
export async function reviseItem(input: {
  readonly itemId: string;
  readonly label?: string | undefined;
  readonly alt?: string | null | undefined;
  readonly transcript?: string | null | undefined;
  readonly synthetic?: boolean | undefined;
}): Promise<GraphOutcome<WrittenItem>> {
  const existing = await readItem(input.itemId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenItem>;
  const parameters: Record<string, unknown> = {};
  const statements = revise(
    "i",
    input.itemId,
    {
      label: input.label === undefined ? undefined : input.label.trim(),
      alt: input.alt === undefined ? undefined : input.alt === null || input.alt.trim() === "" ? null : input.alt.trim(),
      transcript: input.transcript === undefined ? undefined : input.transcript === null || input.transcript.trim() === "" ? null : input.transcript,
      synthetic: input.synthetic,
    },
    { label: existing.result.label, alt: existing.result.alt || undefined, transcript: existing.result.transcript || undefined, synthetic: existing.result.synthetic },
    parameters,
  );
  if (statements.length === 0) {
    return { outcome: "success", result: { itemId: input.itemId, revisionId: existing.result.revisionId, dataRevision: "" } };
  }
  // A SET and a REMOVE on one node cannot travel in one script; each is its own write.
  let last: GraphOutcome<WrittenItem> = { outcome: "success", result: { itemId: input.itemId, revisionId: existing.result.revisionId, dataRevision: "" } };
  for (const statement of statements) {
    last = await commit(statement, parameters, `revise item ${input.itemId}`, async (dataRevision, revisionOf) => ({
      itemId: input.itemId,
      revisionId: await revisionOf(input.itemId),
      dataRevision,
    }));
    if (last.outcome !== "success") return last;
    if (statements.length > 1) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return last;
}

/** Deletes an item with its exports; refused while any deliverable gathers it, naming them. */
export async function deleteItem(input: { readonly itemId: string; readonly baseRevisionId: string }): Promise<GraphOutcome<WrittenItem>> {
  const existing = await readItem(input.itemId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenItem>;
  if (existing.result.revisionId !== input.baseRevisionId) return conflict(input.itemId, input.baseRevisionId, existing.result.revisionId);
  if (existing.result.gatheredBy.length > 0) {
    return refuse("itemGathered", `${existing.result.gatheredBy.map((deliverable) => deliverable.title).join(", ")} gather${existing.result.gatheredBy.length === 1 ? "s" : ""} this item; release it first.`);
  }
  const live = await liveAt(input.itemId);
  if (live.outcome !== "success") return live as GraphOutcome<WrittenItem>;
  if (live.result.length > 0) return refuse("liveAtChannel", `This item is published at ${live.result.length} channel${live.result.length === 1 ? "" : "s"}; retire it there first.`);
  const parameters: Record<string, unknown> = {};
  const statements = [retire("i", input.itemId, parameters), ...existing.result.exports.map((found, at) => retire(`x${at}`, found.exportId, parameters))];
  return commit(statements.join("; "), parameters, `delete item ${input.itemId}`, async (dataRevision) => ({
    itemId: input.itemId,
    revisionId: input.baseRevisionId,
    dataRevision,
  }));
}

export { DELIVERABLE_TYPE };
