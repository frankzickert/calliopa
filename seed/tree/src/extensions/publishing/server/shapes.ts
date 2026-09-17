import { randomUUID } from "node:crypto";

import { orderBetween } from "~/lib/order";
import type { ReadResult } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import type { PartView, ShapeSummary, ShapeView } from "../lib/work";
import {
  activeSources,
  activeTargets,
  allOfType,
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
import {
  COMPOSES,
  FILLS,
  NESTS,
  PART_TYPE,
  SHAPE_TYPE,
  SHAPED,
  constraintsOf,
  partRefusal,
  type Cardinality,
  type Constraints,
  type PartClass,
  type PartRecord,
} from "./vocabulary";

/**
 * Shapes and their parts. PU_0002_002
 *
 * A shape is the author's vocabulary: a title and an ordered list of parts,
 * each a content class with a cardinality, a role and constraints, or a
 * nested shape. Each gesture is one write script through the bridge, refused
 * in words before anything is written.
 */

export interface Written {
  readonly dataRevision: string;
}

export interface WrittenShape extends Written {
  readonly shapeId: string;
  readonly revisionId: string;
}

export function partOf(content: Record<string, unknown>, partId: string): PartRecord {
  return {
    partId,
    title: text(content, "title"),
    class: (text(content, "class") || "file") as PartClass,
    cardinality: (text(content, "cardinality") || "any") as Cardinality,
    role: text(content, "role"),
    constraints: constraintsOf(content["constraints"]),
    order: text(content, "order"),
    shape: text(content, "shape") || null,
  };
}

const byOrder = (left: { readonly order: string }, right: { readonly order: string }): number =>
  left.order < right.order ? -1 : left.order > right.order ? 1 : 0;

/** The parts a shape composes, ordered, out of a read rooted at the shape. */
export function partsOf(graph: ReadResult, shapeId: string, titles: ReadonlyMap<string, string>): PartView[] {
  return activeTargets(graph, shapeId, COMPOSES)
    .map((partId) => {
      const node = nodeIn(graph, partId);
      if (node === undefined) return null;
      const record = partOf(read(node).content, partId);
      return { ...record, shapeTitle: record.shape === null ? null : (titles.get(record.shape) ?? null) };
    })
    .filter((part): part is PartView => part !== null)
    .sort(byOrder);
}

/** Every shape's title by id, so a nested part can name what it nests. */
async function shapeTitles(): Promise<GraphOutcome<Map<string, string>>> {
  const outcome = await allOfType(SHAPE_TYPE, "shapes listing");
  if (outcome.outcome !== "success") return outcome as GraphOutcome<Map<string, string>>;
  return {
    outcome: "success",
    result: new Map(nodesOfType(outcome.result, SHAPE_TYPE).map((node) => [read(node).id, text(read(node).content, "title")])),
  };
}

export async function listShapes(): Promise<GraphOutcome<readonly ShapeSummary[]>> {
  const titles = await shapeTitles();
  if (titles.outcome !== "success") return titles as GraphOutcome<readonly ShapeSummary[]>;
  return {
    outcome: "success",
    result: [...titles.result.entries()]
      .map(([shapeId, title]) => ({ shapeId, title }))
      .sort((left, right) => left.title.localeCompare(right.title)),
  };
}

export async function readShape(shapeId: string): Promise<GraphOutcome<ShapeView>> {
  const [outcome, titles, arriving] = await Promise.all([outgoing([shapeId]), shapeTitles(), incoming([shapeId])]);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<ShapeView>;
  if (titles.outcome !== "success") return titles as GraphOutcome<ShapeView>;
  if (arriving.outcome !== "success") return arriving as GraphOutcome<ShapeView>;
  const node = nodeIn(outcome.result, shapeId) ?? nodeIn(arriving.result, shapeId);
  if (node === undefined || read(node).content["_type"] !== undefined) {
    // `contentOf` strips `_type`; a node of another type is found by the roots' typing below.
  }
  const shapeNode = nodesOfType(merge(outcome.result, arriving.result), SHAPE_TYPE).find((candidate) => read(candidate).id === shapeId);
  if (shapeNode === undefined) return { outcome: "noResult", detail: `No shape ${shapeId} in this graph.` };
  const own = read(shapeNode);
  return {
    outcome: "success",
    result: {
      shapeId,
      title: text(own.content, "title"),
      revisionId: own.revisionId,
      parts: partsOf(outcome.result, shapeId, titles.result),
      nestedIn: activeSources(arriving.result, shapeId, NESTS).map((id) => ({ shapeId: id, title: titles.result.get(id) ?? id })),
    },
  };
}

export async function createShape(input: { readonly title: string }): Promise<GraphOutcome<WrittenShape>> {
  const title = input.title.trim();
  if (title === "") return refuse("titleRequired", "A shape needs a title.");
  const shapeId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const statement = `CREATE (s:${SHAPE_TYPE} {${properties("s", { id: shapeId, title }, parameters)}})`;
  return commit(statement, parameters, `create shape ${shapeId}`, async (dataRevision, revisionOf) => ({
    shapeId,
    revisionId: await revisionOf(shapeId),
    dataRevision,
  }));
}

export async function retitleShape(input: { readonly shapeId: string; readonly title: string }): Promise<GraphOutcome<WrittenShape>> {
  const title = input.title.trim();
  if (title === "") return refuse("titleRequired", "A shape needs a title.");
  const existing = await readShape(input.shapeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenShape>;
  const parameters: Record<string, unknown> = { sNodeId: `node:${input.shapeId}`, s_title: title };
  return commit("SET s.title = $s_title", parameters, `retitle shape ${input.shapeId}`, async (dataRevision, revisionOf) => ({
    shapeId: input.shapeId,
    revisionId: await revisionOf(input.shapeId),
    dataRevision,
  }));
}

/**
 * Deletes a shape with its parts. Refused while a deliverable is shaped by it
 * or another shape nests it, naming how many, so nothing is left pointing at
 * a shape that is gone.
 */
export async function deleteShape(input: { readonly shapeId: string; readonly baseRevisionId: string }): Promise<GraphOutcome<WrittenShape>> {
  const existing = await readShape(input.shapeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenShape>;
  if (existing.result.revisionId !== input.baseRevisionId) {
    return conflict(input.shapeId, input.baseRevisionId, existing.result.revisionId);
  }
  const arriving = await incoming([input.shapeId]);
  if (arriving.outcome !== "success") return arriving as GraphOutcome<WrittenShape>;
  const shaped = activeSources(arriving.result, input.shapeId, SHAPED);
  if (shaped.length > 0) {
    return refuse("shapeInUse", `${shaped.length} deliverable${shaped.length === 1 ? " is" : "s are"} of this shape; delete them first.`);
  }
  if (existing.result.nestedIn.length > 0) {
    return refuse("shapeNested", `${existing.result.nestedIn.map((shape) => shape.title).join(", ")} nest${existing.result.nestedIn.length === 1 ? "s" : ""} this shape; remove that part first.`);
  }
  const parameters: Record<string, unknown> = {};
  const statements = [retire("s", input.shapeId, parameters), ...existing.result.parts.map((part, at) => retire(`p${at}`, part.partId, parameters))];
  return commit(statements.join("; "), parameters, `delete shape ${input.shapeId}`, async (dataRevision) => ({
    shapeId: input.shapeId,
    revisionId: input.baseRevisionId,
    dataRevision,
  }));
}

export interface PartInput {
  readonly title: string;
  readonly class: string;
  readonly cardinality: string;
  readonly role?: string | undefined;
  readonly constraints?: unknown;
  readonly shape?: string | null | undefined;
}

/** Whether nesting `inner` in `outer` would nest a shape in itself, walking what `inner` already nests. */
async function wouldNestItself(outer: string, inner: string): Promise<GraphOutcome<boolean>> {
  const seen = new Set<string>();
  let frontier = [inner];
  while (frontier.length > 0) {
    if (frontier.includes(outer)) return { outcome: "success", result: true };
    const next: string[] = [];
    const outcome = await outgoing(frontier);
    if (outcome.outcome !== "success") return outcome as GraphOutcome<boolean>;
    for (const id of frontier) {
      seen.add(id);
      for (const target of activeTargets(outcome.result, id, NESTS)) if (!seen.has(target)) next.push(target);
    }
    frontier = next;
  }
  return { outcome: "success", result: false };
}

export interface WrittenPart extends Written {
  readonly partId: string;
}

/** Adds a part at the end of the shape's parts. A part of class `shape` also relates the shape to the one it nests. */
export async function addPart(input: { readonly shapeId: string; readonly part: PartInput }): Promise<GraphOutcome<WrittenPart>> {
  const existing = await readShape(input.shapeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenPart>;
  const record = {
    title: input.part.title.trim(),
    class: input.part.class,
    cardinality: input.part.cardinality,
    constraints: constraintsOf(input.part.constraints),
    shape: input.part.shape ?? null,
  };
  const wrong = partRefusal(record);
  if (wrong !== null) return refuse("partShape", wrong);
  if (record.shape !== null) {
    if (record.shape === input.shapeId) return refuse("nestsItself", "A shape cannot nest itself.");
    const inner = await readShape(record.shape);
    if (inner.outcome !== "success") return refuse("unknownShape", `No shape ${record.shape} to nest.`);
    const cycle = await wouldNestItself(input.shapeId, record.shape);
    if (cycle.outcome !== "success") return cycle as GraphOutcome<WrittenPart>;
    if (cycle.result) return refuse("nestsItself", `${inner.result.title} already nests this shape, directly or through another.`);
  }
  const last = existing.result.parts.at(-1)?.order ?? "";
  const order = orderBetween(last, "");
  const partId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const content: Record<string, unknown> = {
    id: partId,
    title: record.title,
    class: record.class,
    cardinality: record.cardinality,
    role: (input.part.role ?? "").trim(),
    constraints: record.constraints,
    order,
    ...(record.shape === null ? {} : { shape: record.shape }),
  };
  const statements = [
    `CREATE (p:${PART_TYPE} {${properties("p", content, parameters)}})`,
    relate("c", COMPOSES, input.shapeId, partId, parameters),
  ];
  // The RELATE target never resolves from the CREATE alias, so the new part is named by its id.
  parameters["cto"] = `node:${partId}`;
  if (record.shape !== null) statements.push(relate("n", NESTS, input.shapeId, record.shape, parameters));
  return commit(statements.join("; "), parameters, `add part ${partId} to shape ${input.shapeId}`, async (dataRevision) => ({
    partId,
    dataRevision,
  }));
}

/** Revises a part's title, cardinality, role or constraints; its class and its nested shape are fixed once made. */
export async function revisePart(input: {
  readonly shapeId: string;
  readonly partId: string;
  readonly title?: string | undefined;
  readonly cardinality?: string | undefined;
  readonly role?: string | undefined;
  readonly constraints?: unknown;
}): Promise<GraphOutcome<WrittenPart>> {
  const existing = await readShape(input.shapeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenPart>;
  const part = existing.result.parts.find((candidate) => candidate.partId === input.partId);
  if (part === undefined) return refuse("unknownPart", `No part ${input.partId} in this shape.`);
  const next = {
    title: (input.title ?? part.title).trim(),
    class: part.class,
    cardinality: input.cardinality ?? part.cardinality,
    constraints: input.constraints === undefined ? part.constraints : constraintsOf(input.constraints),
    shape: part.shape,
  };
  const wrong = partRefusal(next);
  if (wrong !== null) return refuse("partShape", wrong);
  const parameters: Record<string, unknown> = {};
  const statements = revise(
    "p",
    input.partId,
    { title: next.title, cardinality: next.cardinality, role: input.role === undefined ? undefined : input.role.trim(), constraints: next.constraints as Record<string, unknown> },
    { title: part.title, cardinality: part.cardinality, role: part.role, constraints: part.constraints },
    parameters,
  );
  if (statements.length === 0) return { outcome: "success", result: { partId: input.partId, dataRevision: "" } };
  return commit(statements.join("; "), parameters, `revise part ${input.partId}`, async (dataRevision) => ({
    partId: input.partId,
    dataRevision,
  }));
}

/** Moves a part before another, or to the end when `before` is null. */
export async function reorderPart(input: { readonly shapeId: string; readonly partId: string; readonly before: string | null }): Promise<GraphOutcome<WrittenPart>> {
  const existing = await readShape(input.shapeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenPart>;
  const parts = existing.result.parts.filter((candidate) => candidate.partId !== input.partId);
  if (parts.length === existing.result.parts.length) return refuse("unknownPart", `No part ${input.partId} in this shape.`);
  const at = input.before === null ? parts.length : parts.findIndex((candidate) => candidate.partId === input.before);
  if (at < 0) return refuse("unknownPart", `No part ${input.before} in this shape to place before.`);
  const order = orderBetween(parts[at - 1]?.order ?? "", parts[at]?.order ?? "");
  const parameters: Record<string, unknown> = { pNodeId: `node:${input.partId}`, p_order: order };
  return commit("SET p.order = $p_order", parameters, `reorder part ${input.partId}`, async (dataRevision) => ({
    partId: input.partId,
    dataRevision,
  }));
}

/** Removes a part; refused while anything fills it. */
export async function removePart(input: { readonly shapeId: string; readonly partId: string }): Promise<GraphOutcome<WrittenPart>> {
  const existing = await readShape(input.shapeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenPart>;
  const part = existing.result.parts.find((candidate) => candidate.partId === input.partId);
  if (part === undefined) return refuse("unknownPart", `No part ${input.partId} in this shape.`);
  const arriving = await incoming([input.partId]);
  if (arriving.outcome !== "success") return arriving as GraphOutcome<WrittenPart>;
  const filling = activeSources(arriving.result, input.partId, FILLS);
  if (filling.length > 0) return refuse("partFilled", `${filling.length} item${filling.length === 1 ? " fills" : "s fill"} ${part.title}; release ${filling.length === 1 ? "it" : "them"} first.`);
  const parameters: Record<string, unknown> = {};
  return commit(retire("p", input.partId, parameters), parameters, `remove part ${input.partId}`, async (dataRevision) => ({
    partId: input.partId,
    dataRevision,
  }));
}

export { number as numberOf };
export type { Constraints };
