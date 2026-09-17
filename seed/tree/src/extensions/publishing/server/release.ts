import { readBlob } from "~/server/ccgw/blobs";
import { readDocument } from "~/extensions/documents/server/documents";
import type { DocumentView } from "~/extensions/documents/server/assemble";
import { kernelSecrets } from "~/server/kernel/client";
import { createProcess, moveProcess } from "~/server/processes";
import type { GraphOutcome } from "~/server/outcome";
import type { IndexContainer } from "../lib/content-index";
import { isAddressed, isSingleton } from "../lib/content-index";
import type { AtChannel, BindingView, DeliverableView, ItemAtChannel, ItemView, ReleaseEntry } from "../lib/work";
import { assignmentFor, assignmentsOf } from "./assignments";
import { readBinding, writeBinding, type BindingInput } from "./bindings";
import { listChannels, partyOf, readChannel } from "./channels";
import { readDeliverable } from "./deliverables";
import { activeSources, incoming, refuse } from "./graph";
import { readItem } from "./items";
import type { Transport } from "./kinds/contract";
import { deliverVideo, projectVideo, retireVideo, takesItemsOf } from "./kinds/bunny-stream";
import { kindOf } from "./kinds/registry";
import { deliverContainer, projectContainer, retireContainer, underAddress, type ContainerSubmission } from "./kinds/website";
import { entriesForRecord, recordFailure, recordSuccess, stateAt } from "./releases";
import { GATHERS, type FieldFacts } from "./vocabulary";

/**
 * A release: gather, project, declare and upload every object the document
 * names, write, record. Nothing here decides that something should go out;
 * a person pressed. A projection refusal is answered and not logged; a
 * delivery failure is logged, because something was attempted. PU_0003_005
 */

/** The kernel's broker as the transport every kind sends through. */
const transport: Transport = {
  send: async (party, input) => {
    const { hostPath, path, ...rest } = input;
    const address = hostPath === true ? null : ((await kernelSecrets.read(party)).configuration["address"] ?? "");
    return kernelSecrets.request(party, { ...rest, path: address === null ? path : underAddress(address, path) });
  },
};


const fieldFactsOf = (container: IndexContainer): FieldFacts[] =>
  container.fields.map((field) => ({ key: field.key, title: field.title, type: field.type, many: field.many, required: field.required }));

/** Everything the projection is handed for a deliverable at a website channel, or the rule that stops before it. */
async function submissionFor(deliverableId: string, channelId: string): Promise<GraphOutcome<{ readonly submission: ContainerSubmission; readonly party: string; readonly deliverable: DeliverableView }>> {
  const [channel, deliverable] = await Promise.all([readChannel(channelId), readDeliverable(deliverableId)]);
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  if (deliverable.outcome !== "success") return deliverable as GraphOutcome<never>;
  if (!channel.result.kindSummary.readsIndex) return refuse("notAWebsite", `${channel.result.channel.title} is not a website channel; other kinds arrive with their own changes.`);
  if (channel.result.channel.retired) return refuse("channelRetired", `${channel.result.channel.title} is retired.`);
  if (channel.result.credential.state === "unconfigured") return refuse("unconfigured", channel.result.credential.lastError ?? "The channel holds no address and no key.");
  const index = channel.result.index;
  if (index === null) return refuse("indexUnread", "Read the site's index first.");
  const assignment = await assignmentFor(channelId, deliverable.result.shapeId);
  if (assignment.outcome !== "success") return assignment as GraphOutcome<never>;
  if (assignment.result === null) return refuse("notTaken", `${channel.result.channel.title} does not take ${deliverable.result.shapeTitle}.`);
  const container = index.containers.find((kept) => kept.entry.key === assignment.result?.container);
  if (container === undefined || !container.inIndex) return refuse("containerGone", `The site no longer lists ${assignment.result.container}.`);
  const slots = index.slots.filter((kept) => kept.inIndex && kept.entry.container === container.entry.key).map((kept) => kept.entry);
  const binding = await readBinding(deliverableId, "deliverable", channelId);
  if (binding.outcome !== "success") return binding as GraphOutcome<never>;

  const items = new Map<string, ItemView>();
  const documents = new Map<string, DocumentView>();
  // A video's id at the host channel its slot names, read from the log: the
  // external id of its live publication there. PU_0004_005
  const hosts = new Map<string, string>();
  const hostNames = new Map<string, string>();
  const hostTitles = new Map<string, string>();
  for (const filled of deliverable.result.parts) {
    const hostChannel = assignment.result.parts.find((entry) => entry.part === filled.part.partId)?.host ?? null;
    for (const summary of filled.items) {
      const item = await readItem(summary.itemId);
      if (item.outcome !== "success") continue;
      items.set(summary.itemId, item.result);
      if (hostChannel !== null && item.result.class === "video") {
        if (!hostTitles.has(hostChannel)) {
          const hosting = await readChannel(hostChannel);
          hostTitles.set(hostChannel, hosting.outcome === "success" ? hosting.result.channel.title : hostChannel);
        }
        hostNames.set(summary.itemId, hostTitles.get(hostChannel) ?? hostChannel);
        const there = await stateAt(summary.itemId, hostChannel);
        if (there.outcome === "success" && there.result.state === "published" && there.result.externalId !== null) hosts.set(summary.itemId, there.result.externalId);
      }
      if (item.result.documentId !== null) {
        const document = await readDocument(item.result.documentId);
        if (document.outcome === "success") documents.set(item.result.documentId, document.result);
      }
    }
  }
  // The deliverables gathering this one, at their addresses here, and whether each is published.
  const arriving = await incoming([deliverableId]);
  if (arriving.outcome !== "success") return arriving as GraphOutcome<never>;
  const gatherers: { container: string; address: string; published: boolean }[] = [];
  const assignments = await assignmentsOf(channelId);
  if (assignments.outcome !== "success") return assignments as GraphOutcome<never>;
  for (const gathererId of activeSources(arriving.result, deliverableId, GATHERS)) {
    const gatherer = await readDeliverable(gathererId);
    if (gatherer.outcome !== "success") continue;
    const taken = assignments.result.find((candidate) => candidate.shape === gatherer.result.shapeId);
    if (taken === undefined) continue;
    const [theirs, state] = await Promise.all([readBinding(gathererId, "deliverable", channelId), stateAt(gathererId, channelId)]);
    if (theirs.outcome !== "success" || state.outcome !== "success" || theirs.result.address === null) continue;
    gatherers.push({ container: taken.container, address: theirs.result.address, published: state.result.state === "published" });
  }
  return {
    outcome: "success",
    result: {
      party: partyOf(channelId),
      deliverable: deliverable.result,
      submission: {
        container: container.entry,
        slots,
        assignment: { container: assignment.result.container, parts: assignment.result.parts },
        deliverable: deliverable.result,
        binding: binding.result,
        items,
        documents,
        gatherers,
        hosts,
        hostNames,
      },
    },
  };
}

/** What a deliverable is at every channel that takes its shape, with what a publish would refuse today. */
export async function readAt(deliverableId: string): Promise<GraphOutcome<readonly AtChannel[]>> {
  const [deliverable, channels] = await Promise.all([readDeliverable(deliverableId), listChannels()]);
  if (deliverable.outcome !== "success") return deliverable as GraphOutcome<never>;
  if (channels.outcome !== "success") return channels as GraphOutcome<never>;
  const rows: AtChannel[] = [];
  for (const channel of channels.result) {
    const assignment = await assignmentFor(channel.channelId, deliverable.result.shapeId);
    if (assignment.outcome !== "success" || assignment.result === null) continue;
    const detail = await readChannel(channel.channelId);
    if (detail.outcome !== "success" || detail.result.index === null) continue;
    const container = detail.result.index.containers.find((kept) => kept.entry.key === assignment.result?.container)?.entry;
    if (container === undefined) continue;
    const [binding, state] = await Promise.all([readBinding(deliverableId, "deliverable", channel.channelId), stateAt(deliverableId, channel.channelId)]);
    if (binding.outcome !== "success" || state.outcome !== "success") continue;
    const gathered = await submissionFor(deliverableId, channel.channelId);
    const missing: string[] = [];
    if (gathered.outcome !== "success") {
      if (gathered.outcome === "validationFailure") missing.push(...gathered.failures.map((failure) => failure.detail));
    } else {
      const projected = projectContainer(gathered.result.submission);
      if (!projected.ok) missing.push(...projected.refusals.map((refusal) => refusal.detail));
    }
    // What fills each slot: the items in the parts assigned to it, so an entry field is chosen rather than typed.
    const entries: Record<string, { itemId: string; label: string }[]> = {};
    for (const filled of deliverable.result.parts) {
      const slot = assignment.result.parts.find((entry) => entry.part === filled.part.partId)?.slot;
      if (slot === undefined) continue;
      entries[slot] = [...(entries[slot] ?? []), ...filled.items.map((item) => ({ itemId: item.itemId, label: item.label || item.itemId.slice(0, 8) }))];
    }
    rows.push({
      channel,
      container: container.key,
      entries,
      fields: container.fields.map((field) => ({ key: field.key, title: field.title, type: field.type, many: field.many, required: field.required, container: field.container, slot: field.slot })),
      addressed: isAddressed(container.route),
      numbered: !isAddressed(container.route) && !isSingleton(container.route),
      binding: binding.result,
      at: state.result,
      missing,
    });
  }
  return { outcome: "success", result: rows };
}

/** The binding of a deliverable at a channel, written against the container's fields. */
export async function bindDeliverable(input: { readonly deliverableId: string; readonly channelId: string; readonly values: BindingInput }): Promise<GraphOutcome<BindingView>> {
  const gathered = await submissionFor(input.deliverableId, input.channelId);
  if (gathered.outcome !== "success" && gathered.outcome !== "validationFailure") return gathered as GraphOutcome<never>;
  // A binding may be written before the projection can succeed; only the container's fields are needed.
  const channel = await readChannel(input.channelId);
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  const deliverable = await readDeliverable(input.deliverableId);
  if (deliverable.outcome !== "success") return deliverable as GraphOutcome<never>;
  const assignment = await assignmentFor(input.channelId, deliverable.result.shapeId);
  if (assignment.outcome !== "success") return assignment as GraphOutcome<never>;
  if (assignment.result === null) return refuse("notTaken", `${channel.result.channel.title} does not take ${deliverable.result.shapeTitle}.`);
  const container = channel.result.index?.containers.find((kept) => kept.entry.key === assignment.result?.container)?.entry;
  if (container === undefined) return refuse("containerGone", `The site no longer lists ${assignment.result.container}.`);
  return writeBinding({ recordId: input.deliverableId, recordKind: "deliverable", channel: input.channelId, fieldFacts: fieldFactsOf(container), values: input.values });
}

export interface ReleaseOutcome {
  readonly released: boolean;
  readonly entry: ReleaseEntry | null;
  readonly refusals: readonly { readonly rule: string; readonly detail: string }[];
}

/** A step of the order in words, for the process a publish runs as. PU_0009_001 */
export type Progress = (step: string) => Promise<void>;
const silent: Progress = async () => undefined;

/** Publishes a deliverable to a website channel: the whole order, one entry logged when something was attempted. */
export async function publishDeliverable(input: { readonly deliverableId: string; readonly channelId: string }, progress: Progress = silent): Promise<GraphOutcome<ReleaseOutcome>> {
  const gathered = await submissionFor(input.deliverableId, input.channelId);
  if (gathered.outcome !== "success") return gathered as GraphOutcome<ReleaseOutcome>;
  const projected = projectContainer(gathered.result.submission);
  if (!projected.ok) return { outcome: "success", result: { released: false, entry: null, refusals: projected.refusals } };
  const delivered = await deliverContainer(transport, gathered.result.party, projected.document, (hash) => readBlob(hash), progress);
  const common = {
    recordId: input.deliverableId,
    recordKind: "deliverable" as const,
    recordTitle: gathered.result.deliverable.title,
    channel: input.channelId,
    act: "publish" as const,
    objectIds: projected.document.objects.map((object) => object.objectId),
  };
  const entry = delivered.ok
    ? await recordSuccess({ ...common, externalId: delivered.externalId, externalAddress: delivered.externalAddress })
    : await recordFailure({ ...common, detail: delivered.detail });
  if (entry.outcome !== "success") return entry as GraphOutcome<ReleaseOutcome>;
  return { outcome: "success", result: { released: delivered.ok, entry: entry.result, refusals: delivered.ok ? [] : [{ rule: "delivery", detail: delivered.detail }] } };
}

/** Retires a deliverable at a website channel; refused for what was never published there or is already retired. */
export async function retireDeliverable(input: { readonly deliverableId: string; readonly channelId: string; readonly supersededBy?: string | null }, progress: Progress = silent): Promise<GraphOutcome<ReleaseOutcome>> {
  const [state, binding, deliverable, channel] = await Promise.all([
    stateAt(input.deliverableId, input.channelId),
    readBinding(input.deliverableId, "deliverable", input.channelId),
    readDeliverable(input.deliverableId),
    readChannel(input.channelId),
  ]);
  if (state.outcome !== "success") return state as GraphOutcome<never>;
  if (binding.outcome !== "success") return binding as GraphOutcome<never>;
  if (deliverable.outcome !== "success") return deliverable as GraphOutcome<never>;
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  if (state.result.state === "never") return refuse("neverPublished", `${deliverable.result.title} was never published at ${channel.result.channel.title}.`);
  if (state.result.state === "retired") return refuse("alreadyRetired", `${deliverable.result.title} is already retired at ${channel.result.channel.title}.`);
  const route = state.result.externalAddress;
  if (route === null) return refuse("noAddress", "The log holds no address to retire.");
  await progress(`retiring ${route}`);
  const delivered = await retireContainer(transport, partyOf(input.channelId), route, input.supersededBy ?? null);
  const common = { recordId: input.deliverableId, recordKind: "deliverable" as const, recordTitle: deliverable.result.title, channel: input.channelId, act: "retire" as const, objectIds: [] };
  const entry = delivered.ok ? await recordSuccess({ ...common, externalId: delivered.externalId, externalAddress: delivered.externalAddress }) : await recordFailure({ ...common, detail: delivered.detail });
  if (entry.outcome !== "success") return entry as GraphOutcome<ReleaseOutcome>;
  return { outcome: "success", result: { released: delivered.ok, entry: entry.result, refusals: delivered.ok ? [] : [{ rule: "delivery", detail: delivered.detail }] } };
}

/**
 * An item at the channels whose unit is an item and whose offer takes its
 * class: the Bunny Stream channels for a video. The title Bunny shows is the
 * deliverable's with the part's when the item fills a part, and the item's
 * label alone otherwise. PU_0004_003
 */
async function titleFor(item: ItemView): Promise<string> {
  const gatherer = item.gatheredBy[0];
  if (gatherer === undefined) return item.label;
  const deliverable = await readDeliverable(gatherer.deliverableId);
  if (deliverable.outcome !== "success") return item.label;
  const part = deliverable.result.parts.find((filled) => filled.items.some((held) => held.itemId === item.itemId));
  return part === undefined ? item.label : `${deliverable.result.title} — ${part.part.title}`;
}

async function itemSubmissionFor(itemId: string, channelId: string): Promise<GraphOutcome<{ readonly item: ItemView; readonly title: string; readonly party: string }>> {
  const [channel, item] = await Promise.all([readChannel(channelId), readItem(itemId)]);
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  if (item.outcome !== "success") return item as GraphOutcome<never>;
  const kind = kindOf(channel.result.channel.kind);
  if (kind === undefined || !kind.units.includes("item")) return refuse("notAnItemChannel", `${channel.result.channel.title} takes no single item.`);
  if (!takesItemsOf(kind, item.result.class)) return refuse("classNotTaken", `${channel.result.channel.title} takes no ${item.result.class}.`);
  if (channel.result.channel.retired) return refuse("channelRetired", `${channel.result.channel.title} is retired.`);
  if (channel.result.credential.state === "unconfigured") return refuse("unconfigured", channel.result.credential.lastError ?? "The channel holds no address and no key.");
  return { outcome: "success", result: { item: item.result, title: await titleFor(item.result), party: partyOf(channelId) } };
}

/** What an item is at every channel that takes items of its class, with what a publish would refuse today. */
export async function readItemAt(itemId: string): Promise<GraphOutcome<readonly ItemAtChannel[]>> {
  const [item, channels] = await Promise.all([readItem(itemId), listChannels()]);
  if (item.outcome !== "success") return item as GraphOutcome<never>;
  if (channels.outcome !== "success") return channels as GraphOutcome<never>;
  const rows: ItemAtChannel[] = [];
  for (const channel of channels.result) {
    const kind = kindOf(channel.kind);
    if (kind === undefined || !takesItemsOf(kind, item.result.class)) continue;
    const [binding, state] = await Promise.all([readBinding(itemId, "item", channel.channelId), stateAt(itemId, channel.channelId)]);
    if (binding.outcome !== "success" || state.outcome !== "success") continue;
    const gathered = await itemSubmissionFor(itemId, channel.channelId);
    const missing: string[] = [];
    if (gathered.outcome !== "success") {
      if (gathered.outcome === "validationFailure") missing.push(...gathered.failures.map((failure) => failure.detail));
    } else {
      const projected = projectVideo({ item: gathered.result.item, title: gathered.result.title });
      if (!projected.ok) missing.push(...projected.refusals.map((refusal) => refusal.detail));
    }
    rows.push({ channel, binding: binding.result, at: state.result, missing });
  }
  return { outcome: "success", result: rows };
}

/** The binding of an item at a channel: the disclosure, since a fixed offer declares no fields. */
export async function bindItem(input: { readonly itemId: string; readonly channelId: string; readonly values: BindingInput }): Promise<GraphOutcome<BindingView>> {
  const gathered = await itemSubmissionFor(input.itemId, input.channelId);
  if (gathered.outcome !== "success" && gathered.outcome !== "validationFailure") return gathered as GraphOutcome<never>;
  return writeBinding({ recordId: input.itemId, recordKind: "item", channel: input.channelId, fieldFacts: [], values: { disclosure: input.values.disclosure } });
}

/** Publishes a video item to a Bunny Stream channel: project, upload once, record with the guid. */
export async function publishItem(input: { readonly itemId: string; readonly channelId: string }, progress: Progress = silent): Promise<GraphOutcome<ReleaseOutcome>> {
  const gathered = await itemSubmissionFor(input.itemId, input.channelId);
  if (gathered.outcome !== "success") return gathered as GraphOutcome<ReleaseOutcome>;
  const projected = projectVideo({ item: gathered.result.item, title: gathered.result.title });
  if (!projected.ok) return { outcome: "success", result: { released: false, entry: null, refusals: projected.refusals } };
  const common = { recordId: input.itemId, recordKind: "item" as const, recordTitle: gathered.result.item.label, channel: input.channelId, act: "publish" as const, objectIds: [projected.document.export.hash.replace(/^sha256:/u, "")] };
  // The same bytes already live there: nothing is sent, and the new entry carries the id the last one did.
  const held = await entriesForRecord(input.itemId, input.channelId);
  if (held.outcome !== "success") return held as GraphOutcome<never>;
  const live = held.result.find((entry) => entry.outcome === "succeeded");
  const same = live !== undefined && live.act === "publish" && live.externalId !== null && live.externalAddress !== null && live.objectIds[0] === common.objectIds[0];
  const delivered = same
    ? { ok: true as const, externalId: live.externalId as string, externalAddress: live.externalAddress as string }
    : await deliverVideo(transport, gathered.result.party, projected.document, (hash) => readBlob(hash), progress);
  const entry = delivered.ok ? await recordSuccess({ ...common, externalId: delivered.externalId, externalAddress: delivered.externalAddress }) : await recordFailure({ ...common, detail: delivered.detail });
  if (entry.outcome !== "success") return entry as GraphOutcome<ReleaseOutcome>;
  return { outcome: "success", result: { released: delivered.ok, entry: entry.result, refusals: delivered.ok ? [] : [{ rule: "delivery", detail: delivered.detail }] } };
}

/** Retires a video item at a Bunny Stream channel; refused for what was never published there or is already retired. */
export async function retireItem(input: { readonly itemId: string; readonly channelId: string }, progress: Progress = silent): Promise<GraphOutcome<ReleaseOutcome>> {
  const [state, item, channel] = await Promise.all([stateAt(input.itemId, input.channelId), readItem(input.itemId), readChannel(input.channelId)]);
  if (state.outcome !== "success") return state as GraphOutcome<never>;
  if (item.outcome !== "success") return item as GraphOutcome<never>;
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  if (state.result.state === "never") return refuse("neverPublished", `${item.result.label} was never published at ${channel.result.channel.title}.`);
  if (state.result.state === "retired") return refuse("alreadyRetired", `${item.result.label} is already retired at ${channel.result.channel.title}.`);
  const guid = state.result.externalId;
  if (guid === null) return refuse("noAddress", "The log holds no id to retire.");
  await progress(`retiring ${guid} at Bunny`);
  const delivered = await retireVideo(transport, partyOf(input.channelId), guid);
  const common = { recordId: input.itemId, recordKind: "item" as const, recordTitle: item.result.label, channel: input.channelId, act: "retire" as const, objectIds: [] };
  const entry = delivered.ok ? await recordSuccess({ ...common, externalId: delivered.externalId, externalAddress: delivered.externalAddress }) : await recordFailure({ ...common, detail: delivered.detail });
  if (entry.outcome !== "success") return entry as GraphOutcome<ReleaseOutcome>;
  return { outcome: "success", result: { released: delivered.ok, entry: entry.result, refusals: delivered.ok ? [] : [{ rule: "delivery", detail: delivered.detail }] } };
}

/** What an act answers when it runs as a process: the process to follow. */
export interface StartedAct {
  readonly processId: string;
}

export interface ActInput {
  readonly recordKind: "deliverable" | "item";
  readonly recordId: string;
  readonly channelId: string;
  readonly act: "publish" | "retire";
  readonly workspaceId: string;
  readonly supersededBy?: string | null;
}

/** The rules a publish would break today, without attempting anything. */
async function refusalsBefore(input: ActInput): Promise<GraphOutcome<readonly { readonly rule: string; readonly detail: string }[]>> {
  if (input.recordKind === "deliverable") {
    const gathered = await submissionFor(input.recordId, input.channelId);
    if (gathered.outcome !== "success") return gathered as GraphOutcome<never>;
    const projected = projectContainer(gathered.result.submission);
    return { outcome: "success", result: projected.ok ? [] : projected.refusals };
  }
  const gathered = await itemSubmissionFor(input.recordId, input.channelId);
  if (gathered.outcome !== "success") return gathered as GraphOutcome<never>;
  const projected = projectVideo({ item: gathered.result.item, title: gathered.result.title });
  return { outcome: "success", result: projected.ok ? [] : projected.refusals };
}

/**
 * An act as a process: a publish the projection refuses is answered with its
 * rules and no process, since nothing was attempted; otherwise a process is
 * created in the reader's workspace, the act answers it at once, and the order
 * runs on — each step moved onto the process, ending completed with the
 * entry's address or id and the entry's id as its last step, or failed with
 * the delivery's words. PU_0009_001
 */
export async function startAct(input: ActInput): Promise<GraphOutcome<ReleaseOutcome | StartedAct>> {
  const [record, channel] = await Promise.all([input.recordKind === "deliverable" ? readDeliverable(input.recordId) : readItem(input.recordId), readChannel(input.channelId)]);
  if (record.outcome !== "success") return record as GraphOutcome<never>;
  if (channel.outcome !== "success") return channel as GraphOutcome<never>;
  if (input.act === "publish") {
    const refused = await refusalsBefore(input);
    if (refused.outcome !== "success") return refused as GraphOutcome<never>;
    if (refused.result.length > 0) return { outcome: "success", result: { released: false, entry: null, refusals: refused.result } };
  }
  const recordTitle = input.recordKind === "deliverable" ? (record.result as DeliverableView).title : (record.result as ItemView).label;
  const verb = input.act === "publish" ? "Publish" : "Retire";
  const process = await createProcess(input.workspaceId, {
    title: `${verb} ${recordTitle || input.recordId.slice(0, 8)} ${input.act === "publish" ? "to" : "at"} ${channel.result.channel.title}`,
    step: "starting",
    itemId: input.recordId,
    itemKind: `publishing:${input.recordKind}`,
  });
  const progress: Progress = async (step) => {
    await moveProcess(process.id, { state: "running", step, error: null });
  };
  const run = async (): Promise<GraphOutcome<ReleaseOutcome>> => {
    if (input.recordKind === "deliverable") {
      return input.act === "publish" ? publishDeliverable({ deliverableId: input.recordId, channelId: input.channelId }, progress) : retireDeliverable({ deliverableId: input.recordId, channelId: input.channelId, supersededBy: input.supersededBy ?? null }, progress);
    }
    return input.act === "publish" ? publishItem({ itemId: input.recordId, channelId: input.channelId }, progress) : retireItem({ itemId: input.recordId, channelId: input.channelId }, progress);
  };
  void (async () => {
    await moveProcess(process.id, { state: "running", step: "starting", error: null });
    let outcome: GraphOutcome<ReleaseOutcome>;
    try {
      outcome = await run();
    } catch (error) {
      await moveProcess(process.id, { state: "failed", step: null, error: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (outcome.outcome !== "success") {
      const words = outcome.outcome === "validationFailure" ? outcome.failures.map((failure) => failure.detail).join(" ") : `The order could not run: ${JSON.stringify(outcome)}`;
      await moveProcess(process.id, { state: "failed", step: null, error: words });
      return;
    }
    const result = outcome.result;
    if (result.released && result.entry !== null) {
      const where = result.entry.externalAddress ?? result.entry.externalId ?? "";
      await moveProcess(process.id, { state: "completed", step: `${input.act === "publish" ? "landed at" : "retired at"} ${where} · entry ${result.entry.releaseId}`, error: null });
    } else {
      const words = result.refusals.map((refusal) => refusal.detail).join(" ") || "It did not land.";
      await moveProcess(process.id, { state: "failed", step: result.entry === null ? null : `entry ${result.entry.releaseId}`, error: words });
    }
  })();
  return { outcome: "success", result: { processId: process.id } };
}

export { entriesForRecord };
