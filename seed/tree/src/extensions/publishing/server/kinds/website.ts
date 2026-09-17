import type { DocumentView, TextBlockView } from "~/extensions/documents/server/assemble";
import type { IndexContainer, IndexField, IndexSlot, StoredIndex } from "../../lib/content-index";
import { isAddressed, isSingleton } from "../../lib/content-index";
import type { BindingView, DeliverableView, ItemView, PartAssignment } from "../../lib/work";
import { aspectOf } from "../vocabulary";
import { Refusals, type Kind, type Projected, type Transport } from "./contract";

/**
 * The `website` kind: a site that implements the content-index contract and
 * declares what it takes. Calliopa maps the author's shapes onto what the
 * site declares, so no site's vocabulary is Calliopa's and no Calliopa change
 * is needed for a new site. PU_0001_007
 *
 * The channel holds the site's address and the key it presents as a bearer.
 * The probe is `GET <address>/index` with the key: the smallest authenticated
 * call, and one that changes nothing. The index itself is read, parsed and
 * stored by `../index-read.ts`.
 *
 * The publish half is split where the network is: `projectContainer` is a
 * function over records answering the container document or every rule it
 * breaks, and `deliverContainer` is the only part that reaches outward,
 * through the kernel's broker. PU_0003_004
 */

/** Where a website answers its index, relative to the channel's address. */
export const INDEX_PATH = "/index";

/**
 * A path of the site's API placed under the address's own path. The kernel's
 * broker resolves a path against the address the way a browser resolves a
 * link, so an absolute `/index` would replace the address's `/v1` rather than
 * follow it; the kind prefixes its own paths, and sends a path the site
 * answered — host-absolute, like homepage's upload path — as it is.
 */
export const underAddress = (address: string, path: string): string => {
  let prefix = "";
  try {
    prefix = new URL(address).pathname;
  } catch {
    prefix = "";
  }
  return `${prefix.replace(/\/+$/u, "")}${path}`;
};

/** One object a document names, to declare and upload before the document is written. */
export interface NamedObject {
  readonly objectId: string;
  readonly hash: string;
  readonly mediaType: string;
  readonly size: number;
}

export type FieldValue = string | number | boolean | readonly string[];

/** The container document as the site takes it (Website, The Container Document). */
export interface ContainerDocument {
  readonly route: string;
  readonly fields: Readonly<Record<string, FieldValue>>;
  readonly slots: Readonly<Record<string, readonly SlotEntry[]>>;
  readonly objects: readonly NamedObject[];
}

export interface SlotEntry {
  readonly id: string;
  readonly fields: Readonly<Record<string, FieldValue>>;
  readonly media?: string;
  readonly crops?: Readonly<Record<string, string>>;
  readonly host?: string;
  readonly document?: { readonly blocks: readonly SiteBlock[] };
}

export type SiteBlock =
  | { readonly type: "text"; readonly role?: string; readonly runs: readonly { readonly text: string; readonly marks?: readonly string[]; readonly link?: string }[] }
  | { readonly type: "divider" };

/** What the projection is handed: records read, nothing reached for. */
export interface ContainerSubmission {
  readonly container: IndexContainer;
  readonly slots: readonly IndexSlot[];
  readonly assignment: { readonly container: string; readonly parts: readonly PartAssignment[] };
  readonly deliverable: DeliverableView;
  readonly binding: BindingView;
  /** Every item the deliverable gathers, by id, with its exports and document id. */
  readonly items: ReadonlyMap<string, ItemView>;
  /** The body of every prose item, by document id. */
  readonly documents: ReadonlyMap<string, DocumentView>;
  /** The addresses of the deliverables gathering this one at this channel, by the container they are taken into, and whether each is published there. */
  readonly gatherers: readonly { readonly container: string; readonly address: string; readonly published: boolean }[];
  /** The id each video item has at the host channel its slot names, read from the log. PU_0004_005 */
  readonly hosts: ReadonlyMap<string, string>;
  /** The title of the host channel a video item's slot names, so a refusal can say where to publish first. */
  readonly hostNames: ReadonlyMap<string, string>;
}

const objectIdOfHash = (hash: string): string => hash.replace(/^sha256:/u, "");

/** The route with its placeholders filled from the binding, or the rule it breaks. */
function routeOf(container: IndexContainer, binding: BindingView, refusals: Refusals): string {
  let route = container.route;
  if (isAddressed(route)) {
    if (binding.address === null) refusals.refuse("addressRequired", `${container.title} is addressed by slug, and this record has no address at the channel yet.`);
    route = route.replace("{slug}", binding.address ?? "");
  } else if (!isSingleton(route)) {
    if (binding.number === null) refusals.refuse("numberRequired", `${container.title} is numbered, and this record has no number at the channel yet.`);
    route = route.replace("{number}", String(binding.number ?? ""));
  }
  if (route.includes("{parent}")) {
    const parent = binding.fields["parent"];
    if (typeof parent !== "string" || parent === "") refusals.refuse("parentRequired", `${container.title} sits under a parent, and the binding names none.`);
    route = route.replace("{parent}", typeof parent === "string" ? parent : "");
  }
  return route;
}

/** A field's value from the binding, or for a reference from the gatherers first, checked for presence when required. */
function fieldValue(field: IndexField, submission: ContainerSubmission, entryIds: ReadonlySet<string>, refusals: Refusals): FieldValue | undefined {
  const held = submission.binding.fields[field.key];
  let value: FieldValue | undefined = held === undefined || held === null || held === "" ? undefined : (held as FieldValue);
  if (field.type === "reference" && field.container !== null) {
    // Gathering first: the deliverables gathering this one, taken into the referenced container.
    const found = submission.gatherers.filter((gatherer) => gatherer.container === field.container);
    const unpublished = found.find((gatherer) => !gatherer.published);
    if (unpublished !== undefined) {
      refusals.refuse("referenceUnpublished", `${field.title} names ${unpublished.address}, which is not published at this channel yet.`);
    }
    if (found.length > 0) value = field.many ? found.map((gatherer) => gatherer.address) : found[0]?.address;
  }
  if (field.type === "entry" && value !== undefined) {
    const named = Array.isArray(value) ? value : [value];
    for (const id of named) {
      if (typeof id !== "string" || !entryIds.has(id)) refusals.refuse("entryUnknown", `${field.title} names ${String(id)}, which fills no slot of this document.`);
    }
  }
  if (field.required && value === undefined) refusals.refuse("fieldRequired", `${container(submission).title} requires ${field.title}, and it is empty.`);
  return value;
}

const container = (submission: ContainerSubmission): IndexContainer => submission.container;

/** A prose body as the site takes it: the shell's vocabulary, and nothing else. */
function blocksOf(document: DocumentView, refusals: Refusals): SiteBlock[] {
  const blocks: SiteBlock[] = [];
  for (const block of document.blocks) {
    if (block.kind === "divider") {
      blocks.push({ type: "divider" });
    } else if (block.kind === "text") {
      const text = block as TextBlockView;
      blocks.push({
        type: "text",
        ...(text.role === "paragraph" ? {} : { role: text.role }),
        runs: text.runs.map((run) => ({ text: run.text, ...(run.marks === undefined || run.marks.length === 0 ? {} : { marks: [...run.marks] }), ...(run.link === undefined ? {} : { link: run.link }) })),
      });
    } else {
      refusals.refuse("unsupportedBlock", `${document.title} holds a ${block.kind} block, which the site does not take.`);
    }
  }
  return blocks;
}

/** The entry an item makes in a slot, or the rules it breaks. */
function entryOf(slot: IndexSlot, item: ItemView, submission: ContainerSubmission, refusals: Refusals, objects: NamedObject[]): SlotEntry | null {
  const fields: Record<string, FieldValue> = {};
  for (const field of slot.fields) {
    const value = itemField(field, item);
    if (value === undefined) {
      if (field.required) refusals.refuse("slotFieldRequired", `${slot.title} requires ${field.title}, and ${item.label || item.class} states none.`);
    } else {
      fields[field.key] = value;
    }
  }
  const named = (found: { hash: string; mediaType: string; size: number }): string => {
    const objectId = objectIdOfHash(found.hash);
    if (!objects.some((object) => object.objectId === objectId)) objects.push({ objectId, hash: found.hash, mediaType: found.mediaType, size: found.size });
    return objectId;
  };
  switch (slot.class) {
    case "video": {
      const host = submission.hosts.get(item.itemId);
      if (host === undefined) {
        const named = submission.hostNames.get(item.itemId);
        refusals.refuse(
          "noVideoHost",
          named === undefined
            ? `${slot.title} takes the id of a video at a host channel, and no host is named for it; assign the part with its Bunny Stream channel.`
            : `${slot.title} takes the id of a video at ${named}, and ${item.label || "this video"} is not published there yet; publish it to ${named} first.`,
        );
        return null;
      }
      return { id: item.itemId, fields, host };
    }
    case "prose": {
      const document = item.documentId === null ? undefined : submission.documents.get(item.documentId);
      if (document === undefined) {
        refusals.refuse("proseBodyMissing", `${item.label || "This prose"} has no body document.`);
        return null;
      }
      return { id: item.itemId, fields, document: { blocks: blocksOf(document, refusals) } };
    }
    case "image": {
      if (slot.aspects.length > 0) {
        const crops: Record<string, string> = {};
        for (const aspect of slot.aspects) {
          const found = item.exports.find((candidate) => aspectOf(candidate.width, candidate.height) === aspect);
          if (found === undefined) refusals.refuse("cropMissing", `${slot.title} takes ${item.label || "this picture"} at ${aspect}, and it has no export at that aspect.`);
          else crops[aspect] = named(found);
        }
        return { id: item.itemId, fields, crops };
      }
      const found = slot.aspect === null ? item.exports[0] : item.exports.find((candidate) => aspectOf(candidate.width, candidate.height) === slot.aspect);
      if (found === undefined) {
        refusals.refuse("exportMissing", `${slot.title} takes ${item.label || "this picture"}${slot.aspect === null ? "" : ` at ${slot.aspect}`}, and it has no export${slot.aspect === null ? "" : " at that aspect"}.`);
        return null;
      }
      return { id: item.itemId, fields, media: named(found) };
    }
    default: {
      const found = item.exports[0];
      if (found === undefined) {
        refusals.refuse("exportMissing", `${slot.title} takes ${item.label || "this item"}, and it has no export.`);
        return null;
      }
      return { id: item.itemId, fields, media: named(found) };
    }
  }
}

/** A slot field's value, from the item alone. */
function itemField(field: IndexField, item: ItemView): FieldValue | undefined {
  switch (field.key) {
    case "label":
    case "title":
      return item.label || undefined;
    case "alt":
      return item.alt || undefined;
    case "transcript":
      return item.transcript || undefined;
    case "duration_seconds":
    case "durationSeconds":
      return item.durationSeconds === null ? undefined : Math.round(item.durationSeconds);
    case "width":
      return item.width ?? undefined;
    case "height":
      return item.height ?? undefined;
    case "synthetic":
      return item.synthetic;
    default:
      return undefined;
  }
}

/**
 * The container document a website would receive for a deliverable, or every
 * rule it breaks — every one, rather than the first, because an author fixing
 * a publish wants the whole list. Pure. PU_0003_004
 */
export function projectContainer(submission: ContainerSubmission): Projected<ContainerDocument> {
  const refusals = new Refusals();
  const objects: NamedObject[] = [];
  const route = routeOf(submission.container, submission.binding, refusals);
  const partSlot = new Map(submission.assignment.parts.map((entry) => [entry.part, entry.slot]));
  const slots: Record<string, SlotEntry[]> = {};
  const entryIds = new Set<string>();
  for (const filled of submission.deliverable.parts) {
    const slotKey = partSlot.get(filled.part.partId);
    if (slotKey === undefined) continue;
    const slot = submission.slots.find((candidate) => candidate.key === slotKey);
    if (slot === undefined) {
      refusals.refuse("slotGone", `${filled.part.title} is assigned to ${slotKey}, which the site no longer lists.`);
      continue;
    }
    const entries: SlotEntry[] = [];
    for (const summary of filled.items) {
      const item = submission.items.get(summary.itemId);
      if (item === undefined) continue;
      const entry = entryOf(slot, item, submission, refusals, objects);
      if (entry !== null) {
        entries.push(entry);
        entryIds.add(entry.id);
      }
    }
    if (slot.maxCount !== null && entries.length > slot.maxCount) {
      refusals.refuse("tooMany", `${slot.title} takes at most ${slot.maxCount}, and ${filled.part.title} holds ${entries.length}.`);
    }
    slots[slotKey] = [...(slots[slotKey] ?? []), ...entries];
  }
  for (const slot of submission.slots) {
    if (slot.required && (slots[slot.key] ?? []).length === 0) {
      refusals.refuse("slotRequired", `${submission.container.title} requires ${slot.title}, and nothing fills it.`);
    }
  }
  const fields: Record<string, FieldValue> = {};
  for (const field of submission.container.fields) {
    const value = fieldValue(field, submission, entryIds, refusals);
    if (value !== undefined) fields[field.key] = value;
  }
  if (refusals.any) return { ok: false, refusals: refusals.refusals };
  return { ok: true, document: { route, fields, slots, objects } };
}

export type Delivered = { readonly ok: true; readonly externalId: string; readonly externalAddress: string } | { readonly ok: false; readonly detail: string };

const parse = (text: string): unknown => {
  try {
    return text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
};

const refusalOf = (status: number, body: unknown, text: string): string => {
  const error = (body as { error?: { code?: string; message?: string; field?: string; rule?: string } } | null)?.error;
  if (error !== undefined && error !== null) return `${status} ${error.code ?? ""}${error.rule === undefined ? "" : ` ${error.rule}`}${error.field === undefined ? "" : ` (${error.field})`}: ${error.message ?? ""}`.trim();
  return `${status}: ${text.slice(0, 200)}`;
};

/**
 * Delivers a projected document: every object declared, the absent ones
 * uploaded, then the document written. A `2xx` that is not JSON is a failure;
 * a site's own refusal comes back in its own words. PU_0003_004
 */
export async function deliverContainer(transport: Transport, party: string, document: ContainerDocument, bytesOf: (hash: string) => Promise<Uint8Array>, onStep: (step: string) => Promise<void> = async () => undefined): Promise<Delivered> {
  // The steps in words, for the process a publish runs as. PU_0009_001
  if (document.objects.length > 0) await onStep(`declaring ${document.objects.length} ${document.objects.length === 1 ? "object" : "objects"}`);
  let sent = 0;
  for (const object of document.objects) {
    let declared: { status: number; text: string };
    try {
      // Exactly the three keys the site's strict declaration takes: a fourth is refused as unknown.
      declared = await transport.send(party, { method: "POST", path: "/media", body: { mimeType: object.mediaType, bytes: object.size, sha256: object.objectId }, contentType: "application/json" });
    } catch (error) {
      return { ok: false, detail: `Declaring ${object.objectId} did not reach the site: ${error instanceof Error ? error.message : String(error)}` };
    }
    const answer = parse(declared.text) as { exists?: boolean; upload?: string } | null | undefined;
    if (declared.status < 200 || declared.status >= 300 || answer === undefined || answer === null) {
      return { ok: false, detail: `Declaring ${object.objectId}: ${refusalOf(declared.status, answer, declared.text)}` };
    }
    if (answer.exists !== true) {
      sent += 1;
      await onStep(`uploading ${sent} of ${document.objects.length}`);
      const bytes = await bytesOf(object.hash);
      let uploaded: { status: number; text: string };
      try {
        uploaded = await transport.send(party, answer.upload === undefined ? { method: "PUT", path: `/media/${object.objectId}`, bytes, contentType: object.mediaType } : { method: "PUT", path: answer.upload, hostPath: true, bytes, contentType: object.mediaType });
      } catch (error) {
        return { ok: false, detail: `Uploading ${object.objectId} did not reach the site: ${error instanceof Error ? error.message : String(error)}` };
      }
      if (uploaded.status < 200 || uploaded.status >= 300 || parse(uploaded.text) === undefined) {
        return { ok: false, detail: `Uploading ${object.objectId}: ${refusalOf(uploaded.status, parse(uploaded.text), uploaded.text)}` };
      }
    }
  }
  await onStep(`writing ${document.route}`);
  let written: { status: number; text: string };
  try {
    written = await transport.send(party, { method: "PUT", path: document.route, body: { fields: document.fields, slots: document.slots }, contentType: "application/json" });
  } catch (error) {
    return { ok: false, detail: `Writing ${document.route} did not reach the site: ${error instanceof Error ? error.message : String(error)}` };
  }
  const body = parse(written.text);
  if (written.status < 200 || written.status >= 300 || body === undefined || body === null) {
    return { ok: false, detail: `Writing ${document.route}: ${refusalOf(written.status, body, written.text)}` };
  }
  const id = (body as { id?: unknown }).id;
  return { ok: true, externalId: typeof id === "string" ? id : document.route, externalAddress: document.route };
}

/** Retires a record at the site: `DELETE` on its route, a successor named when the author wrote one. */
export async function retireContainer(transport: Transport, party: string, route: string, supersededBy: string | null): Promise<Delivered> {
  let answer: { status: number; text: string };
  try {
    answer = await transport.send(party, { method: "DELETE", path: route, body: supersededBy === null ? {} : { supersededBy }, contentType: "application/json" });
  } catch (error) {
    return { ok: false, detail: `Retiring ${route} did not reach the site: ${error instanceof Error ? error.message : String(error)}` };
  }
  const body = parse(answer.text);
  if (answer.status < 200 || answer.status >= 300 || body === undefined) {
    return { ok: false, detail: `Retiring ${route}: ${refusalOf(answer.status, body, answer.text)}` };
  }
  return { ok: true, externalId: route, externalAddress: route };
}

export const website: Kind = {
  id: "website",
  label: "Website",
  purpose: "A site that declares its own content index and takes container documents over HTTP",
  credential: "apiKey",
  fields: [
    {
      key: "address",
      label: "Address",
      hint: "Where the site answers, for example https://www.example.com/v1",
      check: "address",
    },
  ],
  authorization: { secretField: "apiKey" },
  probe: { method: "GET", url: "{configuration.address}/index", expectStatus: 200 },
  offer: { fromDestination: true },
  units: ["deliverable"],
  acts: ["publish", "retire"],
  publish: {
    project: (submission) => projectContainer(submission as ContainerSubmission),
    deliver: (transport, party, document) => deliverContainer(transport, party, document as ContainerDocument, async () => new Uint8Array()),
  },
};

export type { StoredIndex };
