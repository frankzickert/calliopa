import { randomUUID } from "node:crypto";

import type { GraphOutcome } from "~/server/outcome";
import type { IndexSlot, StoredIndex } from "../lib/content-index";
import type { ChannelSummary } from "../lib/library";
import type { AssignmentView, PartAssignment, TakesView } from "../lib/work";
import { listChannels, readChannel } from "./channels";
import { takesItemsOf } from "./kinds/bunny-stream";
import { kindOf } from "./kinds/registry";
import { activeTargets, allOfType, commit, matching, nodeIn, nodesOfType, outgoing, properties, read, refuse, relate, retire, text } from "./graph";
import { listShapes, partOf, readShape } from "./shapes";
import { ASSIGNMENT_TYPE, OF, PART_TYPE, TAKES, assignmentRefusal, type PartRecord } from "./vocabulary";

/**
 * What a channel takes: a shape assigned to a container the site declares,
 * and each of the shape's parts to a slot of that container. One
 * `assignment` node per channel and shape, holding the part-to-slot list,
 * related to the channel by `takes` and to the shape by `of`. What is
 * assigned is what the index read keeps when the site stops listing a key.
 * PU_0003_002
 */

interface AssignmentNode {
  readonly assignmentId: string;
  readonly channel: string;
  readonly shape: string;
  readonly container: string;
  readonly parts: PartAssignment[];
}

const partsOfContent = (value: unknown): PartAssignment[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is { part: string; slot: string; host?: unknown } => typeof entry === "object" && entry !== null && typeof (entry as { part?: unknown }).part === "string" && typeof (entry as { slot?: unknown }).slot === "string")
        .map((entry) => ({ part: entry.part, slot: entry.slot, host: typeof entry.host === "string" && entry.host !== "" ? entry.host : null }))
    : [];

/** The channels that host videos: every `bunny-stream` one — a kind taking video items — not retired. PU_0004_002 */
export async function videoHosts(): Promise<GraphOutcome<ChannelSummary[]>> {
  const channels = await listChannels();
  if (channels.outcome !== "success") return channels as GraphOutcome<ChannelSummary[]>;
  return {
    outcome: "success",
    result: channels.result.filter((channel) => {
      const kind = kindOf(channel.kind);
      return kind !== undefined && takesItemsOf(kind, "video") && !channel.retired;
    }),
  };
}

/** Every assignment of a channel. */
export async function assignmentsOf(channelId: string): Promise<GraphOutcome<AssignmentNode[]>> {
  const outcome = await matching(ASSIGNMENT_TYPE, { channel: channelId }, "assignments read");
  if (outcome.outcome !== "success") return outcome as GraphOutcome<AssignmentNode[]>;
  return {
    outcome: "success",
    result: nodesOfType(outcome.result, ASSIGNMENT_TYPE).map((node) => {
      const own = read(node);
      return {
        assignmentId: own.id,
        channel: channelId,
        shape: text(own.content, "shape"),
        container: text(own.content, "container"),
        parts: partsOfContent(own.content["parts"]),
      };
    }),
  };
}

/** The keys a channel's assignments name, in `reconcileIndex`'s vocabulary. */
export async function assignedKeys(channelId: string): Promise<ReadonlySet<string>> {
  const outcome = await assignmentsOf(channelId);
  if (outcome.outcome !== "success") return new Set();
  const keys = new Set<string>();
  for (const assignment of outcome.result) {
    keys.add(`container:${assignment.container}`);
    for (const entry of assignment.parts) keys.add(`slot:${entry.slot}`);
  }
  return keys;
}

const slotsOf = (index: StoredIndex, container: string): IndexSlot[] =>
  index.slots.filter((kept) => kept.inIndex && kept.entry.container === container).map((kept) => kept.entry);

/** What a channel takes, with the required slots nothing fills and the shapes one could take. */
export async function readTakes(channelId: string): Promise<GraphOutcome<TakesView>> {
  const [channel, assignments, shapes, hosts] = await Promise.all([readChannel(channelId), assignmentsOf(channelId), listShapes(), videoHosts()]);
  if (channel.outcome !== "success") return channel as GraphOutcome<TakesView>;
  if (assignments.outcome !== "success") return assignments as GraphOutcome<TakesView>;
  if (shapes.outcome !== "success") return shapes as GraphOutcome<TakesView>;
  if (hosts.outcome !== "success") return hosts as GraphOutcome<TakesView>;
  const index = channel.result.index;
  const read = await Promise.all(assignments.result.map((assignment) => readShape(assignment.shape)));
  const views: AssignmentView[] = assignments.result.map((assignment, at) => {
    const filled = new Set(assignment.parts.map((entry) => entry.slot));
    const missing = index === null ? [] : slotsOf(index, assignment.container).filter((slot) => slot.required && !filled.has(slot.key)).map((slot) => slot.key);
    const shape = read[at];
    return {
      assignmentId: assignment.assignmentId,
      shape: { shapeId: assignment.shape, title: shapes.result.find((found) => found.shapeId === assignment.shape)?.title ?? assignment.shape },
      container: assignment.container,
      parts: assignment.parts,
      missing,
      // A shape deleted under its assignment offers nothing to assign.
      shapeParts: shape !== undefined && shape.outcome === "success" ? shape.result.parts : [],
    };
  });
  return { outcome: "success", result: { channelId, assignments: views, shapes: shapes.result, videoHosts: hosts.result } };
}

/** The assignment of one shape at one channel, when there is one. */
export async function assignmentFor(channelId: string, shapeId: string): Promise<GraphOutcome<AssignmentNode | null>> {
  const outcome = await assignmentsOf(channelId);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<AssignmentNode | null>;
  return { outcome: "success", result: outcome.result.find((assignment) => assignment.shape === shapeId) ?? null };
}

/** A channel takes a shape into a container the site declares. */
export async function takeShape(input: { readonly channelId: string; readonly shapeId: string; readonly container: string }): Promise<GraphOutcome<{ readonly assignmentId: string; readonly dataRevision: string }>> {
  const channel = await readChannel(input.channelId);
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  if (!channel.result.kindSummary.readsIndex) return refuse("noIndex", `A ${channel.result.kindSummary.label} channel declares no containers to take a shape into.`);
  const index = channel.result.index;
  if (index === null) return refuse("indexUnread", "Read the site's index first; there is nothing to assign to yet.");
  const container = index.containers.find((kept) => kept.entry.key === input.container);
  if (container === undefined) return refuse("unknownContainer", `The site declares no container ${input.container}.`);
  if (!container.inIndex) return refuse("containerRetired", `The site no longer lists ${input.container}.`);
  const shape = await readShape(input.shapeId);
  if (shape.outcome !== "success") return refuse("unknownShape", `No shape ${input.shapeId} in this graph.`);
  const existing = await assignmentFor(input.channelId, input.shapeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<never>;
  if (existing.result !== null) return refuse("alreadyTaken", `${shape.result.title} is already taken, into ${existing.result.container}.`);
  const assignmentId = randomUUID();
  const parameters: Record<string, unknown> = {};
  const statements = [
    `CREATE (a:${ASSIGNMENT_TYPE} {${properties("a", { id: assignmentId, channel: input.channelId, shape: input.shapeId, container: input.container, parts: [] }, parameters)}})`,
    relate("t", TAKES, input.channelId, assignmentId, parameters),
    relate("o", OF, assignmentId, input.shapeId, parameters),
  ];
  return commit(statements.join("; "), parameters, `channel ${input.channelId} takes shape ${input.shapeId}`, async (dataRevision) => ({ assignmentId, dataRevision }));
}

/**
 * A part of the taken shape assigned to a slot of the container, the rule
 * checked first. A part assigned to a slot of class `video` may name the
 * channel that hosts its videos — a `bunny-stream` one, not retired — and
 * a part of any other class names none. PU_0004_002
 */
export async function assignPart(input: { readonly channelId: string; readonly shapeId: string; readonly partId: string; readonly slot: string; readonly host?: string | null }): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const [channel, assignment, shape] = await Promise.all([readChannel(input.channelId), assignmentFor(input.channelId, input.shapeId), readShape(input.shapeId)]);
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  if (assignment.outcome !== "success") return assignment as GraphOutcome<never>;
  if (shape.outcome !== "success") return refuse("unknownShape", `No shape ${input.shapeId} in this graph.`);
  if (assignment.result === null) return refuse("notTaken", `${shape.result.title} is not taken by this channel yet.`);
  const part = shape.result.parts.find((candidate) => candidate.partId === input.partId);
  if (part === undefined) return refuse("unknownPart", `No part ${input.partId} in ${shape.result.title}.`);
  const index = channel.result.index;
  if (index === null) return refuse("indexUnread", "Read the site's index first.");
  const record: PartRecord = { ...part, constraints: part.constraints };
  const host = typeof input.host === "string" && input.host.trim() !== "" ? input.host.trim() : null;
  if (part.class === "shape") {
    if (host !== null) return refuse("hostNotForClass", `${part.title} nests a shape and takes no video host.`);
    // A nested part is assigned to a container: the one the nested shape is taken into.
    const inner = part.shape === null ? null : (await assignmentFor(input.channelId, part.shape)).outcome === "success" ? ((await assignmentFor(input.channelId, part.shape)) as { result: AssignmentNode | null }).result : null;
    if (inner === null) return refuse("nestedNotTaken", `${part.title} nests ${part.shapeTitle ?? "a shape"}, which this channel does not take yet.`);
    if (inner.container !== input.slot) return refuse("doesNotFit", `${part.title} nests ${part.shapeTitle ?? "a shape"}, taken into ${inner.container}; assign it there.`);
  } else {
    const slot = slotsOf(index, assignment.result.container).find((candidate) => candidate.key === input.slot);
    if (slot === undefined) return refuse("unknownSlot", `${assignment.result.container} has no slot ${input.slot}.`);
    const wrong = assignmentRefusal(record, { key: slot.key, title: slot.title, class: slot.class, aspect: slot.aspect, aspects: slot.aspects, maxDurationSeconds: slot.maxDurationSeconds, formats: slot.formats });
    if (wrong !== null) return refuse("doesNotFit", wrong);
    if (slot.class === "video") {
      // A host may be named later; the publish refuses in words until it is.
      if (host !== null) {
      const hosting = await readChannel(host);
      if (hosting.outcome !== "success") return refuse("notAVideoHost", `No channel ${host} to host ${part.title}'s videos.`);
      const kind = kindOf(hosting.result.channel.kind);
      if (kind === undefined || !takesItemsOf(kind, "video")) return refuse("notAVideoHost", `${hosting.result.channel.title} is a ${hosting.result.channel.kindLabel} channel and hosts no videos.`);
      if (hosting.result.channel.retired) return refuse("notAVideoHost", `${hosting.result.channel.title} is retired.`);
      }
    } else if (host !== null) {
      return refuse("hostNotForClass", `${slot.title} takes ${slot.class}, which needs no video host.`);
    }
  }
  const parts = [...assignment.result.parts.filter((entry) => entry.part !== input.partId), { part: input.partId, slot: input.slot, ...(host === null ? {} : { host }) }];
  const parameters: Record<string, unknown> = { aNodeId: `node:${assignment.result.assignmentId}`, a_parts: parts };
  return commit("SET a.parts = $a_parts", parameters, `assign part ${input.partId} to ${input.slot}`, async (dataRevision) => ({ dataRevision }));
}

/** A part's assignment released, the slot left empty. */
export async function releasePart(input: { readonly channelId: string; readonly shapeId: string; readonly partId: string }): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const assignment = await assignmentFor(input.channelId, input.shapeId);
  if (assignment.outcome !== "success") return assignment as GraphOutcome<never>;
  if (assignment.result === null) return refuse("notTaken", "This channel does not take that shape.");
  const parts = assignment.result.parts.filter((entry) => entry.part !== input.partId);
  if (parts.length === assignment.result.parts.length) return refuse("notAssigned", "That part is not assigned.");
  const parameters: Record<string, unknown> = { aNodeId: `node:${assignment.result.assignmentId}`, a_parts: parts };
  return commit("SET a.parts = $a_parts", parameters, `release part ${input.partId}`, async (dataRevision) => ({ dataRevision }));
}

/** A shape no longer taken; its assignment retired. */
export async function dropShape(input: { readonly channelId: string; readonly shapeId: string }): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const assignment = await assignmentFor(input.channelId, input.shapeId);
  if (assignment.outcome !== "success") return assignment as GraphOutcome<never>;
  if (assignment.result === null) return refuse("notTaken", "This channel does not take that shape.");
  const parameters: Record<string, unknown> = {};
  return commit(retire("a", assignment.result.assignmentId, parameters), parameters, `channel ${input.channelId} drops shape ${input.shapeId}`, async (dataRevision) => ({ dataRevision }));
}

/** The parts of a shape, by id, out of a read rooted at the shape — for the projection. */
export async function partsById(shapeId: string): Promise<GraphOutcome<Map<string, PartRecord>>> {
  const outcome = await outgoing([shapeId]);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<never>;
  const parts = new Map<string, PartRecord>();
  for (const partId of activeTargets(outcome.result, shapeId, "composes")) {
    const node = nodeIn(outcome.result, partId);
    if (node !== undefined && nodesOfType(outcome.result, PART_TYPE).includes(node)) parts.set(partId, partOf(read(node).content, partId));
  }
  return { outcome: "success", result: parts };
}

export { allOfType };
