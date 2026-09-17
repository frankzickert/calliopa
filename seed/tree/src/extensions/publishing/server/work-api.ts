import type { ApiRoute } from "~/contract";
import { refusal, respond, type GraphOutcome, type OutcomeResponse } from "~/server/outcome";
import type { DeliverablesListing, StandingListing } from "../lib/work";
import {
  createDeliverable,
  deleteDeliverable,
  listDeliverables,
  placeDeliverable,
  placeItem,
  readDeliverable,
  release,
  retitleDeliverable,
} from "./deliverables";
import { UPLOAD_CAP_BYTES, addExport, createProseItem, deleteItem, ingestItem, listStanding, readItem, reviseItem } from "./items";
import { addPart, createShape, deleteShape, listShapes, readShape, removePart, reorderPart, retitleShape, revisePart } from "./shapes";
import { assignPart, dropShape, readTakes, releasePart, takeShape } from "./assignments";
import { retireChannel } from "./channels";
import { bindDeliverable, bindItem, publishDeliverable, publishItem, readAt, readItemAt, retireDeliverable, retireItem, startAct } from "./release";
import { entriesForChannel, entriesForRecord } from "./releases";

/**
 * The transport the workspace reaches shapes, deliverables and items
 * through: it reads a request and reports an outcome, and decides nothing
 * about what an operation means. PU_0002_002 PU_0002_003 PU_0002_004
 */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

async function decode(request: Request): Promise<Record<string, unknown>> {
  try {
    return record((await request.json()) as unknown) ?? {};
  } catch {
    return {};
  }
}

const text = (body: Record<string, unknown>, name: string): string => {
  const value = body[name];
  return typeof value === "string" ? value : "";
};

const optional = (body: Record<string, unknown>, name: string): string | undefined => {
  const value = body[name];
  return typeof value === "string" ? value : undefined;
};

const nullable = (body: Record<string, unknown>, name: string): string | null | undefined => {
  const value = body[name];
  return value === null ? null : typeof value === "string" ? value : undefined;
};

const flag = (body: Record<string, unknown>, name: string): boolean | undefined => {
  const value = body[name];
  return typeof value === "boolean" ? value : undefined;
};

const answer = async <T>(event: { json: (status: number, body: unknown) => void }, outcome: Promise<GraphOutcome<T>>, created = false): Promise<void> => {
  const { status, body }: OutcomeResponse<T> = respond(await outcome);
  event.json(created && status === 200 ? 201 : status, body);
};

const baseRevision = (body: Record<string, unknown>): GraphOutcome<never> | string => {
  const found = text(body, "baseRevisionId");
  return found === "" ? refusal("baseRevisionId", "Say which revision is being deleted.") : found;
};

/** An upload's bytes and what the browser said of them. */
async function upload(event: { request: Request; url: URL }): Promise<{ bytes: Uint8Array; mediaType: string; filename: string | undefined }> {
  const bytes = new Uint8Array(await event.request.arrayBuffer());
  const mediaType = (event.request.headers.get("content-type") ?? "application/octet-stream").split(";")[0]?.trim() ?? "application/octet-stream";
  const named = event.request.headers.get("x-filename") ?? event.url.searchParams.get("filename");
  return { bytes, mediaType, filename: named === null || named === "" ? undefined : decodeURIComponent(named) };
}

export async function deliverablesListing(): Promise<DeliverablesListing> {
  const outcome = await listDeliverables();
  return outcome.outcome === "success" ? outcome.result : { reachable: false, shapes: [], groups: [] };
}

export async function standingListing(): Promise<StandingListing> {
  const outcome = await listStanding();
  return { reachable: outcome.outcome === "success", items: outcome.outcome === "success" ? outcome.result : [], uploadCapBytes: UPLOAD_CAP_BYTES };
}

export const workRoutes: readonly ApiRoute[] = [
  // Shapes and parts.
  { method: "GET", path: "shapes", handle: (event) => answer(event, listShapes()) },
  {
    method: "POST",
    path: "shapes",
    handle: async (event) => answer(event, createShape({ title: text(await decode(event.request), "title") }), true),
  },
  { method: "GET", path: "shapes/[id]", handle: (event, params) => answer(event, readShape(params["id"] ?? "")) },
  {
    method: "PUT",
    path: "shapes/[id]",
    handle: async (event, params) => answer(event, retitleShape({ shapeId: params["id"] ?? "", title: text(await decode(event.request), "title") })),
  },
  {
    method: "DELETE",
    path: "shapes/[id]",
    handle: async (event, params) => {
      const base = baseRevision(await decode(event.request));
      if (typeof base !== "string") return answer(event, Promise.resolve(base));
      return answer(event, deleteShape({ shapeId: params["id"] ?? "", baseRevisionId: base }));
    },
  },
  {
    method: "POST",
    path: "shapes/[id]/parts",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(
        event,
        addPart({
          shapeId: params["id"] ?? "",
          part: {
            title: text(body, "title"),
            class: text(body, "class"),
            cardinality: text(body, "cardinality") || "any",
            role: optional(body, "role"),
            constraints: body["constraints"],
            shape: nullable(body, "shape") ?? null,
          },
        }),
        true,
      );
    },
  },
  {
    method: "PUT",
    path: "shapes/[id]/parts/[part]",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(
        event,
        revisePart({
          shapeId: params["id"] ?? "",
          partId: params["part"] ?? "",
          title: optional(body, "title"),
          cardinality: optional(body, "cardinality"),
          role: optional(body, "role"),
          constraints: body["constraints"],
        }),
      );
    },
  },
  {
    method: "POST",
    path: "shapes/[id]/parts/[part]/move",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(event, reorderPart({ shapeId: params["id"] ?? "", partId: params["part"] ?? "", before: nullable(body, "before") ?? null }));
    },
  },
  {
    method: "DELETE",
    path: "shapes/[id]/parts/[part]",
    handle: (event, params) => answer(event, removePart({ shapeId: params["id"] ?? "", partId: params["part"] ?? "" })),
  },

  // Deliverables and placement.
  { method: "GET", path: "deliverables", handle: async (event) => event.json(200, await deliverablesListing()) },
  {
    method: "POST",
    path: "deliverables",
    handle: async (event) => {
      const body = await decode(event.request);
      return answer(event, createDeliverable({ shapeId: text(body, "shapeId"), title: text(body, "title") }), true);
    },
  },
  { method: "GET", path: "deliverables/[id]", handle: (event, params) => answer(event, readDeliverable(params["id"] ?? "")) },
  {
    method: "PUT",
    path: "deliverables/[id]",
    handle: async (event, params) => answer(event, retitleDeliverable({ deliverableId: params["id"] ?? "", title: text(await decode(event.request), "title") })),
  },
  {
    method: "DELETE",
    path: "deliverables/[id]",
    handle: async (event, params) => {
      const base = baseRevision(await decode(event.request));
      if (typeof base !== "string") return answer(event, Promise.resolve(base));
      return answer(event, deleteDeliverable({ deliverableId: params["id"] ?? "", baseRevisionId: base }));
    },
  },
  {
    // An existing item placed into a part.
    method: "POST",
    path: "deliverables/[id]/parts/[part]/items",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(event, placeItem({ deliverableId: params["id"] ?? "", partId: params["part"] ?? "", itemId: text(body, "itemId") }));
    },
  },
  {
    // A file uploaded into a part: the item is created and placed in one gesture.
    method: "POST",
    path: "deliverables/[id]/parts/[part]/upload",
    handle: async (event, params) => {
      const { bytes, mediaType, filename } = await upload(event);
      const itemClass = event.url.searchParams.get("class") ?? undefined;
      const ingested = await ingestItem({ bytes, mediaType, filename, class: itemClass, label: event.url.searchParams.get("label") ?? undefined });
      if (ingested.outcome !== "success") return answer(event, Promise.resolve(ingested));
      const placed = await placeItem({ deliverableId: params["id"] ?? "", partId: params["part"] ?? "", itemId: ingested.result.itemId });
      if (placed.outcome !== "success") {
        // The item exists and stands; the part's refusal is what the reader is told.
        return answer(event, Promise.resolve(placed));
      }
      return answer(event, Promise.resolve({ outcome: "success" as const, result: { ...placed.result, itemId: ingested.result.itemId } }), true);
    },
  },
  {
    method: "POST",
    path: "deliverables/[id]/parts/[part]/deliverables",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(event, placeDeliverable({ deliverableId: params["id"] ?? "", partId: params["part"] ?? "", innerId: text(body, "deliverableId") }));
    },
  },
  {
    method: "DELETE",
    path: "deliverables/[id]/parts/[part]/members/[member]",
    handle: (event, params) => answer(event, release({ deliverableId: params["id"] ?? "", partId: params["part"] ?? "", memberId: params["member"] ?? "" })),
  },

  // Items and exports.
  { method: "GET", path: "items/standing", handle: async (event) => event.json(200, await standingListing()) },
  {
    // A file uploaded as a standing item.
    method: "POST",
    path: "items",
    handle: async (event) => {
      const { bytes, mediaType, filename } = await upload(event);
      return answer(
        event,
        ingestItem({ bytes, mediaType, filename, class: event.url.searchParams.get("class") ?? undefined, label: event.url.searchParams.get("label") ?? undefined }),
        true,
      );
    },
  },
  {
    method: "POST",
    path: "items/prose",
    handle: async (event) => answer(event, createProseItem({ label: text(await decode(event.request), "label") }), true),
  },
  { method: "GET", path: "items/[id]", handle: (event, params) => answer(event, readItem(params["id"] ?? "")) },
  {
    method: "PUT",
    path: "items/[id]",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(
        event,
        reviseItem({
          itemId: params["id"] ?? "",
          label: optional(body, "label"),
          alt: nullable(body, "alt"),
          transcript: nullable(body, "transcript"),
          synthetic: flag(body, "synthetic"),
        }),
      );
    },
  },
  {
    method: "DELETE",
    path: "items/[id]",
    handle: async (event, params) => {
      const base = baseRevision(await decode(event.request));
      if (typeof base !== "string") return answer(event, Promise.resolve(base));
      return answer(event, deleteItem({ itemId: params["id"] ?? "", baseRevisionId: base }));
    },
  },
  {
    method: "POST",
    path: "items/[id]/exports",
    handle: async (event, params) => {
      const { bytes, mediaType, filename } = await upload(event);
      const replaces = event.url.searchParams.get("replaces") ?? undefined;
      return answer(event, addExport({ itemId: params["id"] ?? "", bytes, mediaType, filename, replaces }), true);
    },
  },

  // What a channel takes, and its log. PU_0003_002 PU_0003_006
  { method: "GET", path: "channels/[id]/takes", handle: (event, params) => answer(event, readTakes(params["id"] ?? "")) },
  {
    method: "POST",
    path: "channels/[id]/takes",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(event, takeShape({ channelId: params["id"] ?? "", shapeId: text(body, "shapeId"), container: text(body, "container") }), true);
    },
  },
  {
    method: "DELETE",
    path: "channels/[id]/takes/[shape]",
    handle: (event, params) => answer(event, dropShape({ channelId: params["id"] ?? "", shapeId: params["shape"] ?? "" })),
  },
  {
    method: "PUT",
    path: "channels/[id]/takes/[shape]/parts/[part]",
    handle: async (event, params) => {
      const body = await decode(event.request);
      return answer(event, assignPart({ channelId: params["id"] ?? "", shapeId: params["shape"] ?? "", partId: params["part"] ?? "", slot: text(body, "slot"), host: optional(body, "host") ?? null }));
    },
  },
  {
    method: "DELETE",
    path: "channels/[id]/takes/[shape]/parts/[part]",
    handle: (event, params) => answer(event, releasePart({ channelId: params["id"] ?? "", shapeId: params["shape"] ?? "", partId: params["part"] ?? "" })),
  },
  { method: "GET", path: "channels/[id]/released", handle: (event, params) => answer(event, entriesForChannel(params["id"] ?? "")) },
  {
    method: "POST",
    path: "channels/[id]/retire",
    handle: async (event, params) => {
      const base = baseRevision(await decode(event.request));
      if (typeof base !== "string") return answer(event, Promise.resolve(base));
      return answer(event, retireChannel({ channelId: params["id"] ?? "", baseRevisionId: base }));
    },
  },

  // A deliverable at its channels: the rows, the binding, the acts. PU_0003_003 PU_0003_005 PU_0003_006
  { method: "GET", path: "deliverables/[id]/at", handle: (event, params) => answer(event, readAt(params["id"] ?? "")) },
  { method: "GET", path: "deliverables/[id]/at/[channel]/released", handle: (event, params) => answer(event, entriesForRecord(params["id"] ?? "", params["channel"] ?? "")) },
  {
    method: "PUT",
    path: "deliverables/[id]/at/[channel]/binding",
    handle: async (event, params) => {
      const body = await decode(event.request);
      const values = {
        ...(body["address"] === undefined ? {} : { address: body["address"] === null ? null : String(body["address"]) }),
        ...(body["number"] === undefined ? {} : { number: body["number"] === null ? null : Number(body["number"]) }),
        ...(record(body["fields"]) === null ? {} : { fields: record(body["fields"]) ?? {} }),
        ...(body["disclosure"] === undefined ? {} : { disclosure: body["disclosure"] === null ? null : body["disclosure"] === true }),
      };
      return answer(event, bindDeliverable({ deliverableId: params["id"] ?? "", channelId: params["channel"] ?? "", values }));
    },
  },
  {
    // Releasing and retiring are one route: the same act with opposite intent, from one panel.
    method: "POST",
    path: "deliverables/[id]/at/[channel]/act",
    handle: async (event, params) => {
      const body = await decode(event.request);
      const input = { deliverableId: params["id"] ?? "", channelId: params["channel"] ?? "" };
      const act = text(body, "act") === "retire" ? ("retire" as const) : ("publish" as const);
      const workspaceId = optional(body, "workspaceId");
      // With a workspace the act runs as a process the tab follows; without one it runs to its outcome, as the suites call it. PU_0009_001
      if (workspaceId !== undefined && workspaceId !== "") {
        return answer(event, startAct({ recordKind: "deliverable", recordId: input.deliverableId, channelId: input.channelId, act, workspaceId, supersededBy: optional(body, "supersededBy") ?? null }));
      }
      return answer(event, act === "retire" ? retireDeliverable({ ...input, supersededBy: optional(body, "supersededBy") ?? null }) : publishDeliverable(input));
    },
  },

  // An item at its channels: the rows, the disclosure, the acts. PU_0004_003
  { method: "GET", path: "items/[id]/at", handle: (event, params) => answer(event, readItemAt(params["id"] ?? "")) },
  { method: "GET", path: "items/[id]/at/[channel]/released", handle: (event, params) => answer(event, entriesForRecord(params["id"] ?? "", params["channel"] ?? "")) },
  {
    method: "PUT",
    path: "items/[id]/at/[channel]/binding",
    handle: async (event, params) => {
      const body = await decode(event.request);
      const values = { ...(body["disclosure"] === undefined ? {} : { disclosure: body["disclosure"] === null ? null : body["disclosure"] === true }) };
      return answer(event, bindItem({ itemId: params["id"] ?? "", channelId: params["channel"] ?? "", values }));
    },
  },
  {
    method: "POST",
    path: "items/[id]/at/[channel]/act",
    handle: async (event, params) => {
      const body = await decode(event.request);
      const input = { itemId: params["id"] ?? "", channelId: params["channel"] ?? "" };
      const act = text(body, "act") === "retire" ? ("retire" as const) : ("publish" as const);
      const workspaceId = optional(body, "workspaceId");
      if (workspaceId !== undefined && workspaceId !== "") {
        return answer(event, startAct({ recordKind: "item", recordId: input.itemId, channelId: input.channelId, act, workspaceId }));
      }
      return answer(event, act === "retire" ? retireItem(input) : publishItem(input));
    },
  },
];
