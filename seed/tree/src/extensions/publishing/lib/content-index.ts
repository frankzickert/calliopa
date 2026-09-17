/**
 * The content index a website declares at `GET <address>/index`: the
 * containers it serves, the slots inside them, and its site-wide copy fields.
 * The parser is the refusal rule — a broken index stores nothing and the
 * refusal names the entry and the field — and unknown properties are
 * stripped, so a site may extend its index without breaking a client that
 * does not read the extension. PU_0001_007
 *
 * Pure: functions over plain values, proven without a site.
 */

/** The five content classes everything publishable is one of. */
export const CONTENT_CLASSES = ["video", "image", "audio", "prose", "file"] as const;
export type ContentClass = (typeof CONTENT_CLASSES)[number];

export const FIELD_TYPES = ["line", "text", "date", "flag", "reference", "integer", "entry"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const COPY_TYPES = ["line", "text"] as const;
export type CopyType = (typeof COPY_TYPES)[number];

export const ASPECTS = ["16:9", "9:16", "1:1", "4:5"] as const;
export type Aspect = (typeof ASPECTS)[number];

export const INDEX_VERSION = 1;

const CONTAINER_KEY = /^[a-z0-9-]+$/u;
const FIELD_KEY = /^[a-z0-9_]+$/u;
const PLACEHOLDER = /\{([^}]*)\}/gu;

export interface IndexField {
  readonly key: string;
  readonly title: string;
  readonly type: FieldType;
  /** The container a `reference` field names; `null` for every other type. */
  readonly container: string | null;
  /** The slot of the same container an `entry` field names; `null` for every other type. PU_0008_001 */
  readonly slot: string | null;
  /** Whether a `reference` or `entry` field takes a list rather than one. PU_0007_002 PU_0008_001 */
  readonly many: boolean;
  /** Whether the site requires the field; the projection refuses one left empty. PU_0008_001 */
  readonly required: boolean;
}

export interface IndexContainer {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  /** The route template a container document is written at. */
  readonly route: string;
  readonly fields: readonly IndexField[];
}

export interface IndexSlot {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly class: ContentClass;
  readonly container: string;
  readonly required: boolean;
  readonly aspect: Aspect | null;
  /** One picture in several crops, one per aspect; empty unless declared. PU_0007_004 */
  readonly aspects: readonly Aspect[];
  /** The slot's own fields, filled from the item that fills it. PU_0007_003 */
  readonly fields: readonly IndexField[];
  readonly formats: readonly string[];
  readonly maxLength: number | null;
  readonly maxCount: number | null;
  readonly maxDurationSeconds: number | null;
}

export interface IndexCopyField {
  readonly key: string;
  readonly title: string;
  readonly type: CopyType;
  readonly group: string;
}

export interface ContentIndex {
  readonly version: number;
  readonly containers: readonly IndexContainer[];
  readonly slots: readonly IndexSlot[];
  readonly copy: readonly IndexCopyField[];
}

/** One thing wrong with an index, naming where. */
export interface IndexRefusal {
  readonly entry: string;
  readonly field: string;
  readonly message: string;
}

export type Parsed =
  | { readonly ok: true; readonly index: ContentIndex }
  | { readonly ok: false; readonly refusals: readonly IndexRefusal[] };

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

class Collector {
  readonly refusals: IndexRefusal[] = [];
  refuse(entry: string, field: string, message: string): void {
    this.refusals.push({ entry, field, message });
  }
}

function text(
  into: Collector,
  entry: string,
  source: Record<string, unknown>,
  field: string,
  required: boolean,
): string {
  const value = source[field];
  if (value === undefined || value === null) {
    if (required) into.refuse(entry, field, `${field} is required.`);
    return "";
  }
  if (typeof value !== "string") {
    into.refuse(entry, field, `${field} must be text.`);
    return "";
  }
  if (required && value.trim() === "") into.refuse(entry, field, `${field} must not be blank.`);
  return value.trim();
}

function key(
  into: Collector,
  entry: string,
  source: Record<string, unknown>,
  pattern: RegExp,
  words: string,
): string {
  const value = text(into, entry, source, "key", true);
  if (value !== "" && !pattern.test(value)) into.refuse(entry, "key", `key must be ${words}.`);
  return value;
}

function oneOf<T extends string>(
  into: Collector,
  entry: string,
  source: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  required: boolean,
): T | null {
  const value = source[field];
  if (value === undefined || value === null) {
    if (required) into.refuse(entry, field, `${field} is required.`);
    return null;
  }
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    into.refuse(entry, field, `${field} must be one of ${allowed.join(", ")}.`);
    return null;
  }
  return value as T;
}

function wholeNumber(
  into: Collector,
  entry: string,
  source: Record<string, unknown>,
  field: string,
): number | null {
  const value = source[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    into.refuse(entry, field, `${field} must be a whole number above zero.`);
    return null;
  }
  return value;
}

function flag(into: Collector, entry: string, source: Record<string, unknown>, field: string): boolean {
  const value = source[field];
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") {
    into.refuse(entry, field, `${field} must be true or false.`);
    return false;
  }
  return value;
}

function strings(into: Collector, entry: string, source: Record<string, unknown>, field: string): string[] {
  const value = source[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    into.refuse(entry, field, `${field} must be a list of names.`);
    return [];
  }
  return value.map((item: string) => item.trim());
}

function list(into: Collector, entry: string, source: Record<string, unknown>, field: string): Record<string, unknown>[] {
  const value = source[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    into.refuse(entry, field, `${field} must be a list.`);
    return [];
  }
  return value.map((item, at) => {
    const found = record(item);
    if (found === null) into.refuse(`${field}[${at}]`, "", "each entry must be an object.");
    return found ?? {};
  });
}

/**
 * A route template starts with `/` and names `{number}`, `{slug}` and
 * `{parent}` placeholders only. A container is numbered (`{number}`), or
 * addressed (`{slug}`, the record's address from its binding), or a singleton
 * (neither) — one of the first two, never both; `{parent}` needs one of them,
 * because a child sits under its parent. Which a container is, is derived
 * from the route, never declared. PU_0007_001
 */
export function routeRefusal(route: string): string | null {
  if (!route.startsWith("/")) return "route must start with /.";
  const names = [...route.matchAll(PLACEHOLDER)].map((match) => match[1]);
  const unknown = names.find((name) => name !== "number" && name !== "slug" && name !== "parent");
  if (unknown !== undefined) return `route names {${unknown}}; only {number}, {slug} and {parent} are placeholders.`;
  if (names.includes("number") && names.includes("slug")) return "route names both {number} and {slug}; a container is numbered or addressed, not both.";
  if (names.includes("parent") && !names.includes("number") && !names.includes("slug")) {
    return "route names {parent} without {number} or {slug}.";
  }
  return null;
}

export const isSingleton = (route: string): boolean => !route.includes("{number}") && !route.includes("{slug}");
export const isAddressed = (route: string): boolean => route.includes("{slug}");

function fields(
  into: Collector,
  entry: string,
  source: Record<string, unknown>,
  containers: ReadonlySet<string>,
  /** The slots the index lists under the fields' own container, so an `entry` field may name one listed after it. */
  ownSlots: ReadonlySet<string>,
): IndexField[] {
  const seen = new Set<string>();
  return list(into, entry, source, "fields").map((raw, at) => {
    const where = `${entry}.fields[${at}]`;
    const fieldKey = key(into, where, raw, FIELD_KEY, "lowercase letters, digits and underscores");
    if (fieldKey !== "" && seen.has(fieldKey)) into.refuse(where, "key", `key ${fieldKey} is listed twice.`);
    seen.add(fieldKey);
    const type = oneOf(into, where, raw, "type", FIELD_TYPES, false) ?? "line";
    let container: string | null = null;
    if (type === "reference") {
      container = text(into, where, raw, "container", true) || null;
      if (container !== null && !containers.has(container)) {
        into.refuse(where, "container", `container ${container} is not listed.`);
      }
    } else if (raw["container"] !== undefined) {
      into.refuse(where, "container", "container belongs to a reference field.");
    }
    let slot: string | null = null;
    if (type === "entry") {
      slot = text(into, where, raw, "slot", true) || null;
      if (slot !== null && !ownSlots.has(slot)) {
        into.refuse(where, "slot", `slot ${slot} is not a slot of this container.`);
      }
    } else if (raw["slot"] !== undefined) {
      into.refuse(where, "slot", "slot belongs to an entry field.");
    }
    const many = flag(into, where, raw, "many");
    if (many && type !== "reference" && type !== "entry") into.refuse(where, "many", "many belongs to a reference or entry field.");
    const required = flag(into, where, raw, "required");
    return { key: fieldKey, title: text(into, where, raw, "title", true), type, container, slot, many, required };
  });
}

/** The keys a list of raw entries declares, before any is parsed, so a field may reference a container listed after it. */
const declaredKeys = (raw: readonly Record<string, unknown>[]): Set<string> =>
  new Set(raw.map((entry) => (typeof entry["key"] === "string" ? entry["key"].trim() : "")).filter((found) => found !== ""));

/** The slot keys declared under each container, before any slot is parsed, so an `entry` field may name a slot listed after it. */
function declaredSlots(raw: readonly Record<string, unknown>[]): (container: string) => ReadonlySet<string> {
  const byContainer = new Map<string, Set<string>>();
  for (const entry of raw) {
    const slotKey = typeof entry["key"] === "string" ? entry["key"].trim() : "";
    const container = typeof entry["container"] === "string" ? entry["container"].trim() : "";
    if (slotKey === "" || container === "") continue;
    const set = byContainer.get(container) ?? new Set<string>();
    set.add(slotKey);
    byContainer.set(container, set);
  }
  const none: ReadonlySet<string> = new Set();
  return (container) => byContainer.get(container) ?? none;
}

function aspects(into: Collector, entry: string, source: Record<string, unknown>): Aspect[] {
  const value = source["aspects"];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !(ASPECTS as readonly string[]).includes(item))) {
    into.refuse(entry, "aspects", `aspects must be a list of ${ASPECTS.join(", ")}.`);
    return [];
  }
  const found = value as Aspect[];
  if (new Set(found).size !== found.length) into.refuse(entry, "aspects", "aspects lists an aspect twice.");
  if (source["aspect"] !== undefined && source["aspect"] !== null) {
    into.refuse(entry, "aspects", "aspects and aspect cannot both be declared.");
  }
  return found;
}

/** Parses what a site answered at `/index`, or names everything wrong with it. */
export function parseContentIndex(value: unknown): Parsed {
  const into = new Collector();
  const root = record(value);
  if (root === null) {
    return { ok: false, refusals: [{ entry: "index", field: "", message: "the index must be a JSON object." }] };
  }
  if (root["version"] !== INDEX_VERSION) {
    into.refuse("index", "version", `version must be ${INDEX_VERSION}.`);
  }

  const rawContainers = list(into, "index", root, "containers");
  const declared = declaredKeys(rawContainers);
  const rawSlots = list(into, "index", root, "slots");
  const slotsOf = declaredSlots(rawSlots);
  const containerKeys = new Set<string>();
  const containers: IndexContainer[] = rawContainers.map((raw, at) => {
    const entry = `containers[${at}]`;
    const containerKey = key(into, entry, raw, CONTAINER_KEY, "lowercase letters, digits and hyphens");
    if (containerKey !== "" && containerKeys.has(containerKey)) into.refuse(entry, "key", `key ${containerKey} is listed twice.`);
    containerKeys.add(containerKey);
    const route = text(into, entry, raw, "route", true);
    const wrong = route === "" ? null : routeRefusal(route);
    if (wrong !== null) into.refuse(entry, "route", wrong);
    return {
      key: containerKey,
      title: text(into, entry, raw, "title", true),
      description: text(into, entry, raw, "description", false),
      route,
      fields: fields(into, entry, raw, declared, slotsOf(containerKey)),
    };
  });

  const slotKeys = new Set<string>();
  const slots: IndexSlot[] = rawSlots.map((raw, at) => {
    const entry = `slots[${at}]`;
    const slotKey = key(into, entry, raw, CONTAINER_KEY, "lowercase letters, digits and hyphens");
    if (slotKey !== "" && slotKeys.has(slotKey)) into.refuse(entry, "key", `key ${slotKey} is listed twice.`);
    slotKeys.add(slotKey);
    const container = text(into, entry, raw, "container", true);
    if (container !== "" && !containerKeys.has(container)) {
      into.refuse(entry, "container", `container ${container} is not listed.`);
    }
    return {
      key: slotKey,
      title: text(into, entry, raw, "title", true),
      description: text(into, entry, raw, "description", false),
      class: oneOf(into, entry, raw, "class", CONTENT_CLASSES, true) ?? "file",
      container,
      required: flag(into, entry, raw, "required"),
      aspect: oneOf(into, entry, raw, "aspect", ASPECTS, false),
      aspects: aspects(into, entry, raw),
      fields: fields(into, entry, raw, declared, slotsOf(container)),
      formats: strings(into, entry, raw, "formats"),
      maxLength: wholeNumber(into, entry, raw, "maxLength"),
      maxCount: wholeNumber(into, entry, raw, "maxCount"),
      maxDurationSeconds: wholeNumber(into, entry, raw, "maxDurationSeconds"),
    };
  });

  const copyKeys = new Set<string>();
  const copy: IndexCopyField[] = list(into, "index", root, "copy").map((raw, at) => {
    const entry = `copy[${at}]`;
    const copyKey = key(into, entry, raw, FIELD_KEY, "lowercase letters, digits and underscores");
    if (copyKey !== "" && copyKeys.has(copyKey)) into.refuse(entry, "key", `key ${copyKey} is listed twice.`);
    copyKeys.add(copyKey);
    return {
      key: copyKey,
      title: text(into, entry, raw, "title", true),
      type: oneOf(into, entry, raw, "type", COPY_TYPES, false) ?? "line",
      group: text(into, entry, raw, "group", false),
    };
  });

  if (into.refusals.length > 0) return { ok: false, refusals: into.refusals };
  return { ok: true, index: { version: INDEX_VERSION, containers, slots, copy } };
}

/** An entry of the stored index: what the site declared, and whether it still does. */
export interface Kept<T> {
  readonly entry: T;
  readonly inIndex: boolean;
}

export interface StoredIndex {
  readonly readAt: string;
  readonly containers: readonly Kept<IndexContainer>[];
  readonly slots: readonly Kept<IndexSlot>[];
  readonly copy: readonly Kept<IndexCopyField>[];
}

export interface Reconciled {
  readonly stored: StoredIndex;
  /** Keys no longer listed and kept because something is assigned to them. */
  readonly retired: readonly string[];
  /** Keys no longer listed and dropped because nothing was assigned to them. */
  readonly dropped: readonly string[];
  /** Slots whose class changed, so what was assigned to them no longer fits. */
  readonly reclassed: readonly string[];
}

function reconcileList<T extends { readonly key: string }>(
  held: readonly Kept<T>[],
  fresh: readonly T[],
  assigned: ReadonlySet<string>,
  prefix: string,
  report: { retired: string[]; dropped: string[] },
): Kept<T>[] {
  const next: Kept<T>[] = fresh.map((entry) => ({ entry, inIndex: true }));
  const listed = new Set(fresh.map((entry) => entry.key));
  for (const kept of held) {
    if (listed.has(kept.entry.key)) continue;
    const name = `${prefix}:${kept.entry.key}`;
    if (assigned.has(name)) {
      next.push({ entry: kept.entry, inIndex: false });
      report.retired.push(name);
    } else {
      report.dropped.push(name);
    }
  }
  return next;
}

/**
 * Lays a fresh read over what was stored: a key the site still lists is
 * current; a key it no longer lists is retired while something is assigned
 * to it and dropped otherwise; a slot whose class changed is named, so the
 * assignments that no longer fit can be dropped by whoever holds them.
 */
export function reconcileIndex(
  held: StoredIndex | null,
  fresh: ContentIndex,
  assigned: ReadonlySet<string>,
  readAt: string,
): Reconciled {
  const report = { retired: [] as string[], dropped: [] as string[] };
  const reclassed: string[] = [];
  const heldSlots = held?.slots ?? [];
  for (const slot of fresh.slots) {
    const before = heldSlots.find((kept) => kept.entry.key === slot.key);
    if (before !== undefined && before.entry.class !== slot.class) reclassed.push(`slot:${slot.key}`);
  }
  return {
    stored: {
      readAt,
      containers: reconcileList(held?.containers ?? [], fresh.containers, assigned, "container", report),
      slots: reconcileList(heldSlots, fresh.slots, assigned, "slot", report),
      copy: reconcileList(held?.copy ?? [], fresh.copy, assigned, "copy", report),
    },
    retired: report.retired,
    dropped: report.dropped,
    reclassed,
  };
}
