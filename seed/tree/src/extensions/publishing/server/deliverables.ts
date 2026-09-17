import { randomUUID } from "node:crypto";

import type { ReadResult } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import type { DeliverableSummary, DeliverableView, DeliverablesListing, FilledPart, ItemSummary, PartView, ShapeSummary } from "../lib/work";
import {
  activeRelation,
  activeTargets,
  allOfType,
  close,
  commit,
  conflict,
  merge,
  nodeIn,
  nodesOfType,
  outgoing,
  properties,
  read,
  refuse,
  relate,
  retire,
  text,
} from "./graph";
import { exportsOf, itemSummaryOf, listItems, readItem } from "./items";
import { liveAt } from "./releases";
import { partsOf } from "./shapes";
import { DELIVERABLE_TYPE, EXPORTED, FILLS, GATHERS, ITEM_TYPE, SHAPE_TYPE, SHAPED, placementRefusal } from "./vocabulary";

/**
 * Deliverables and placement. PU_0002_003
 *
 * A deliverable is an instance of a shape, filled part by part with items —
 * or, for a part that nests a shape, with deliverables of that shape. A
 * part's cardinality and constraints are checked where something is placed;
 * what does not fit is refused naming the rule and stays free to fit elsewhere.
 */

export interface WrittenDeliverable {
  readonly deliverableId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

async function shapeTitles(): Promise<GraphOutcome<{ readonly titles: Map<string, string>; readonly graph: ReadResult }>> {
  const outcome = await allOfType(SHAPE_TYPE, "shapes listing");
  if (outcome.outcome !== "success") return outcome as GraphOutcome<never>;
  return {
    outcome: "success",
    result: {
      graph: outcome.result,
      titles: new Map(nodesOfType(outcome.result, SHAPE_TYPE).map((node) => [read(node).id, text(read(node).content, "title")])),
    },
  };
}

/** Every deliverable grouped by its shape, with every shape one can be created from. */
export async function listDeliverables(): Promise<GraphOutcome<DeliverablesListing>> {
  const [all, shapes] = await Promise.all([allOfType(DELIVERABLE_TYPE, "deliverables listing"), shapeTitles()]);
  if (all.outcome !== "success") return all as GraphOutcome<DeliverablesListing>;
  if (shapes.outcome !== "success") return shapes as GraphOutcome<DeliverablesListing>;
  const ids = nodesOfType(all.result, DELIVERABLE_TYPE).map((node) => read(node).id);
  const leaving = await outgoing(ids);
  if (leaving.outcome !== "success") return leaving as GraphOutcome<DeliverablesListing>;
  const summaries: DeliverableSummary[] = nodesOfType(all.result, DELIVERABLE_TYPE).map((node) => {
    const own = read(node);
    const shapeId = activeTargets(leaving.result, own.id, SHAPED)[0] ?? "";
    return { deliverableId: own.id, title: text(own.content, "title"), shapeId, shapeTitle: shapes.result.titles.get(shapeId) ?? shapeId };
  });
  const shapeList: ShapeSummary[] = [...shapes.result.titles.entries()]
    .map(([shapeId, title]) => ({ shapeId, title }))
    .sort((left, right) => left.title.localeCompare(right.title));
  const groups = shapeList
    .map((shape) => ({
      shape,
      deliverables: summaries.filter((found) => found.shapeId === shape.shapeId).sort((left, right) => left.title.localeCompare(right.title)),
    }))
    .filter((group) => group.deliverables.length > 0);
  return { outcome: "success", result: { reachable: true, shapes: shapeList, groups } };
}

/**
 * The deliverable with its shape's parts and what fills them: one read from
 * the deliverable, one from the shape and the items and deliverables it
 * gathers, so reading a deliverable never walks into the rest of the graph.
 */
export async function readDeliverable(deliverableId: string): Promise<GraphOutcome<DeliverableView>> {
  const first = await outgoing([deliverableId]);
  if (first.outcome !== "success") return first as GraphOutcome<DeliverableView>;
  const node = nodesOfType(first.result, DELIVERABLE_TYPE).find((candidate) => read(candidate).id === deliverableId);
  if (node === undefined) return { outcome: "noResult", detail: `No deliverable ${deliverableId} in this graph.` };
  const own = read(node);
  const shapeId = activeTargets(first.result, deliverableId, SHAPED)[0];
  if (shapeId === undefined) return { outcome: "storageError", detail: `Deliverable ${deliverableId} has no shape.` };
  const gathered = activeTargets(first.result, deliverableId, GATHERS);
  const [second, shapes, everyItem] = await Promise.all([outgoing([shapeId, ...gathered]), shapeTitles(), listItems()]);
  if (second.outcome !== "success") return second as GraphOutcome<DeliverableView>;
  if (shapes.outcome !== "success") return shapes as GraphOutcome<DeliverableView>;
  if (everyItem.outcome !== "success") return everyItem as GraphOutcome<DeliverableView>;
  const graph = merge(first.result, second.result);
  const parts: PartView[] = partsOf(second.result, shapeId, shapes.result.titles);
  const gatheredItems = gathered.filter((id) => nodeIn(graph, id) !== undefined && read(nodeIn(graph, id)!).content["class"] !== undefined && nodesOfType(graph, ITEM_TYPE).some((candidate) => read(candidate).id === id));
  const gatheredDeliverables = gathered.filter((id) => nodesOfType(graph, DELIVERABLE_TYPE).some((candidate) => read(candidate).id === id));
  const filled: FilledPart[] = parts.map((part) => ({
    part,
    items: gatheredItems
      .filter((itemId) => activeTargets(graph, itemId, FILLS).includes(part.partId))
      .map((itemId) => itemSummaryOf(read(nodeIn(graph, itemId)!).content, itemId, activeTargets(graph, itemId, EXPORTED).length)),
    deliverables: gatheredDeliverables
      .filter((id) => activeTargets(graph, id, FILLS).includes(part.partId))
      .map((id) => {
        const inner = read(nodeIn(graph, id)!);
        const innerShape = activeTargets(graph, id, SHAPED)[0] ?? "";
        return { deliverableId: id, title: text(inner.content, "title"), shapeId: innerShape, shapeTitle: shapes.result.titles.get(innerShape) ?? innerShape };
      }),
  }));
  const gatheredSet = new Set(gatheredItems);
  const candidates: ItemSummary[] = everyItem.result.items.filter((item) => !gatheredSet.has(item.itemId));
  return {
    outcome: "success",
    result: {
      deliverableId,
      title: text(own.content, "title"),
      shapeId,
      shapeTitle: shapes.result.titles.get(shapeId) ?? shapeId,
      revisionId: own.revisionId,
      parts: filled,
      candidates,
    },
  };
}

export async function createDeliverable(input: { readonly shapeId: string; readonly title: string }): Promise<GraphOutcome<WrittenDeliverable>> {
  const title = input.title.trim();
  if (title === "") return refuse("titleRequired", "A deliverable needs a title.");
  const shapes = await shapeTitles();
  if (shapes.outcome !== "success") return shapes as GraphOutcome<WrittenDeliverable>;
  if (!shapes.result.titles.has(input.shapeId)) return refuse("unknownShape", `No shape ${input.shapeId} in this graph.`);
  const deliverableId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const statements = [
    `CREATE (d:${DELIVERABLE_TYPE} {${properties("d", { id: deliverableId, title }, parameters)}})`,
    relate("s", SHAPED, deliverableId, input.shapeId, parameters),
  ];
  return commit(statements.join("; "), parameters, `create deliverable ${deliverableId}`, async (dataRevision, revisionOf) => ({
    deliverableId,
    revisionId: await revisionOf(deliverableId),
    dataRevision,
  }));
}

export async function retitleDeliverable(input: { readonly deliverableId: string; readonly title: string }): Promise<GraphOutcome<WrittenDeliverable>> {
  const title = input.title.trim();
  if (title === "") return refuse("titleRequired", "A deliverable needs a title.");
  const existing = await readDeliverable(input.deliverableId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenDeliverable>;
  const parameters: Record<string, unknown> = { dNodeId: `node:${input.deliverableId}`, d_title: title };
  return commit("SET d.title = $d_title", parameters, `retitle deliverable ${input.deliverableId}`, async (dataRevision, revisionOf) => ({
    deliverableId: input.deliverableId,
    revisionId: await revisionOf(input.deliverableId),
    dataRevision,
  }));
}

/**
 * Deletes a deliverable; what it gathered stays. Refused while it is live at
 * any channel, naming each, so a page the author believes gone is never
 * still served: retiring there is its own act. PU_0003_005
 */
export async function deleteDeliverable(input: { readonly deliverableId: string; readonly baseRevisionId: string }): Promise<GraphOutcome<WrittenDeliverable>> {
  const existing = await readDeliverable(input.deliverableId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenDeliverable>;
  if (existing.result.revisionId !== input.baseRevisionId) return conflict(input.deliverableId, input.baseRevisionId, existing.result.revisionId);
  const live = await liveAt(input.deliverableId);
  if (live.outcome !== "success") return live as GraphOutcome<WrittenDeliverable>;
  if (live.result.length > 0) return refuse("liveAtChannel", `This deliverable is published at ${live.result.length} channel${live.result.length === 1 ? "" : "s"}; retire it there first.`);
  const parameters: Record<string, unknown> = {};
  return commit(retire("d", input.deliverableId, parameters), parameters, `delete deliverable ${input.deliverableId}`, async (dataRevision) => ({
    deliverableId: input.deliverableId,
    revisionId: input.baseRevisionId,
    dataRevision,
  }));
}

/** Places an item into a part of the deliverable: `gathers` and `fills` in one script, the part's rules checked first. */
export async function placeItem(input: { readonly deliverableId: string; readonly partId: string; readonly itemId: string }): Promise<GraphOutcome<WrittenDeliverable>> {
  const existing = await readDeliverable(input.deliverableId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenDeliverable>;
  const filled = existing.result.parts.find((candidate) => candidate.part.partId === input.partId);
  if (filled === undefined) return refuse("unknownPart", `No part ${input.partId} in this deliverable's shape.`);
  if (filled.items.some((item) => item.itemId === input.itemId)) return refuse("alreadyPlaced", `This item already fills ${filled.part.title}.`);
  const item = await readItem(input.itemId);
  if (item.outcome !== "success") return refuse("unknownItem", `No item ${input.itemId} in this graph.`);
  const wrong = placementRefusal(
    { ...filled.part, constraints: filled.part.constraints },
    { class: item.result.class, durationSeconds: item.result.durationSeconds, width: item.result.width, height: item.result.height },
    item.result.exports,
    filled.items.length,
  );
  if (wrong !== null) return refuse("doesNotFit", wrong);
  const leaving = await outgoing([input.deliverableId]);
  if (leaving.outcome !== "success") return leaving as GraphOutcome<WrittenDeliverable>;
  const parameters: Record<string, unknown> = {};
  const statements = [];
  if (activeRelation(leaving.result, input.deliverableId, GATHERS, input.itemId) === undefined) {
    statements.push(relate("g", GATHERS, input.deliverableId, input.itemId, parameters));
  }
  statements.push(relate("f", FILLS, input.itemId, input.partId, parameters));
  return commit(statements.join("; "), parameters, `place item ${input.itemId} in ${filled.part.title} of ${input.deliverableId}`, async (dataRevision) => ({
    deliverableId: input.deliverableId,
    revisionId: existing.result.revisionId,
    dataRevision,
  }));
}

/** Places a deliverable of the nested shape into a part of class `shape`. */
export async function placeDeliverable(input: { readonly deliverableId: string; readonly partId: string; readonly innerId: string }): Promise<GraphOutcome<WrittenDeliverable>> {
  const existing = await readDeliverable(input.deliverableId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenDeliverable>;
  const filled = existing.result.parts.find((candidate) => candidate.part.partId === input.partId);
  if (filled === undefined) return refuse("unknownPart", `No part ${input.partId} in this deliverable's shape.`);
  if (filled.part.class !== "shape") return refuse("doesNotFit", `${filled.part.title} takes ${filled.part.class}, not a deliverable.`);
  if (input.innerId === input.deliverableId) return refuse("gathersItself", "A deliverable cannot gather itself.");
  if (filled.deliverables.some((found) => found.deliverableId === input.innerId)) return refuse("alreadyPlaced", `That deliverable already fills ${filled.part.title}.`);
  if ((filled.part.cardinality === "one" || filled.part.cardinality === "optional") && filled.deliverables.length >= 1) {
    return refuse("doesNotFit", `${filled.part.title} takes one and already holds one.`);
  }
  const inner = await readDeliverable(input.innerId);
  if (inner.outcome !== "success") return refuse("unknownDeliverable", `No deliverable ${input.innerId} in this graph.`);
  if (inner.result.shapeId !== filled.part.shape) {
    return refuse("doesNotFit", `${filled.part.title} takes a ${filled.part.shapeTitle ?? "nested"} deliverable, and this one is ${inner.result.shapeTitle}.`);
  }
  const leaving = await outgoing([input.deliverableId]);
  if (leaving.outcome !== "success") return leaving as GraphOutcome<WrittenDeliverable>;
  const parameters: Record<string, unknown> = {};
  const statements = [];
  if (activeRelation(leaving.result, input.deliverableId, GATHERS, input.innerId) === undefined) {
    statements.push(relate("g", GATHERS, input.deliverableId, input.innerId, parameters));
  }
  statements.push(relate("f", FILLS, input.innerId, input.partId, parameters));
  return commit(statements.join("; "), parameters, `place deliverable ${input.innerId} in ${filled.part.title} of ${input.deliverableId}`, async (dataRevision) => ({
    deliverableId: input.deliverableId,
    revisionId: existing.result.revisionId,
    dataRevision,
  }));
}

/** Takes an item or a nested deliverable out of a part: both relations closed, nothing deleted. */
export async function release(input: { readonly deliverableId: string; readonly partId: string; readonly memberId: string }): Promise<GraphOutcome<WrittenDeliverable>> {
  const [leaving, member] = await Promise.all([outgoing([input.deliverableId]), outgoing([input.memberId])]);
  if (leaving.outcome !== "success") return leaving as GraphOutcome<WrittenDeliverable>;
  if (member.outcome !== "success") return member as GraphOutcome<WrittenDeliverable>;
  const gathers = activeRelation(leaving.result, input.deliverableId, GATHERS, input.memberId);
  if (gathers === undefined) return refuse("notGathered", "This deliverable does not gather that.");
  const fills = activeRelation(member.result, input.memberId, FILLS, input.partId);
  const parameters: Record<string, unknown> = {};
  const statements = [close("g", gathers.id, input.deliverableId, parameters)];
  if (fills !== undefined) statements.push(close("f", fills.id, input.memberId, parameters));
  return commit(statements.join("; "), parameters, `release ${input.memberId} from ${input.deliverableId}`, async (dataRevision, revisionOf) => ({
    deliverableId: input.deliverableId,
    revisionId: await revisionOf(input.deliverableId),
    dataRevision,
  }));
}

export { exportsOf };
