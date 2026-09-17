import { ASPECTS, CONTENT_CLASSES, type Aspect, type ContentClass } from "../lib/content-index";
import type { Constraints } from "../lib/work";

export type { Constraints };

/**
 * The work layer's vocabulary as this extension writes it — the type names
 * declared as its members, the part's cardinalities and constraints, and the
 * pure rules a placement is checked by. None of the names reuses
 * `calliopa-video`'s while that extension's members stand. PU_0002_001
 */

export const SHAPE_TYPE = "shape";
export const PART_TYPE = "part";
export const DELIVERABLE_TYPE = "deliverable";
export const ITEM_TYPE = "item";
export const EXPORT_TYPE = "export";

export const COMPOSES = "composes";
export const NESTS = "nests";
export const SHAPED = "shaped";
export const GATHERS = "gathers";
export const FILLS = "fills";
export const EXPORTED = "exported";
export const PROSE = "prose";

export const ASSIGNMENT_TYPE = "assignment";
export const BINDING_TYPE = "binding";
export const RELEASE_TYPE = "release";
export const TAKES = "takes";
export const OF = "of";

/** How many items a part takes: exactly one, at most one, one or more, any number. */
export const CARDINALITIES = ["one", "optional", "some", "any"] as const;
export type Cardinality = (typeof CARDINALITIES)[number];

/** A part's class: a content class, or a shape it nests. */
export const PART_CLASSES = [...CONTENT_CLASSES, "shape"] as const;
export type PartClass = (typeof PART_CLASSES)[number];

export const PROVENANCES = ["ingested", "produced"] as const;
export type Provenance = (typeof PROVENANCES)[number];

export const CONSTRAINT_KEYS = ["aspect", "maxDurationSeconds", "minWidth", "minHeight", "formats"] as const;

/** A part as this extension reads it. */
export interface PartRecord {
  readonly partId: string;
  readonly title: string;
  readonly class: PartClass;
  readonly cardinality: Cardinality;
  readonly role: string;
  readonly constraints: Constraints;
  readonly order: string;
  /** The shape a `shape` part nests; `null` for a content class. */
  readonly shape: string | null;
}

export interface ExportFacts {
  readonly mediaType: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface ItemFacts {
  readonly class: ContentClass;
  readonly durationSeconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The reduced `w:h` of a picture, or `null` when it has no dimensions. */
export function aspectOf(width: number | null, height: number | null): string | null {
  if (width === null || height === null || width <= 0 || height <= 0) return null;
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/** Whether a reduced aspect is one of the four the vocabulary names. */
export const isAspect = (value: string): value is Aspect => (ASPECTS as readonly string[]).includes(value);

/** The media subtype an export's type names: `video/mp4` is `mp4`. */
export const formatOf = (mediaType: string): string => mediaType.split("/")[1]?.split(";")[0]?.trim().toLowerCase() ?? "";

/**
 * Whether an item may be placed into a part, in words: its class must be the
 * part's, the part's cardinality must have room, and its exports must meet
 * the part's constraints — at least one export at the aspect, every export
 * within the duration, one export at least the dimensions, one export in the
 * formats. An item that does not fit stays free to fit another part.
 * PU_0002_003
 */
export function placementRefusal(
  part: PartRecord,
  item: ItemFacts,
  exports: readonly ExportFacts[],
  alreadyFilling: number,
): string | null {
  if (part.class === "shape") return `${part.title} takes a deliverable of a shape, not an item.`;
  if (item.class !== part.class) return `${part.title} takes ${part.class}, and this item is ${item.class}.`;
  if ((part.cardinality === "one" || part.cardinality === "optional") && alreadyFilling >= 1) {
    return `${part.title} takes one item and already holds one.`;
  }
  const constraints = part.constraints;
  if (constraints.aspect !== undefined) {
    const found = exports.some((found) => aspectOf(found.width, found.height) === constraints.aspect);
    if (!found) return `${part.title} needs an export at ${constraints.aspect}, and this item has none.`;
  }
  if (constraints.maxDurationSeconds !== undefined) {
    if (item.durationSeconds === null) return `${part.title} limits the duration to ${constraints.maxDurationSeconds}s, and this item states none.`;
    if (item.durationSeconds > constraints.maxDurationSeconds) {
      return `${part.title} limits the duration to ${constraints.maxDurationSeconds}s, and this item runs ${Math.round(item.durationSeconds)}s.`;
    }
  }
  if (constraints.minWidth !== undefined || constraints.minHeight !== undefined) {
    const minWidth = constraints.minWidth ?? 0;
    const minHeight = constraints.minHeight ?? 0;
    const found = exports.some((found) => (found.width ?? 0) >= minWidth && (found.height ?? 0) >= minHeight);
    if (!found) return `${part.title} needs an export of at least ${minWidth}×${minHeight}, and this item has none.`;
  }
  if (constraints.formats !== undefined && constraints.formats.length > 0) {
    const wanted = constraints.formats.map((format) => format.toLowerCase());
    const found = exports.some((found) => wanted.includes(formatOf(found.mediaType)));
    if (!found) return `${part.title} takes ${wanted.join(", ")}, and this item has no export in one of them.`;
  }
  return null;
}

/** What a part's input must be, in words, before anything is written. */
export function partRefusal(input: {
  readonly title: string;
  readonly class: string;
  readonly cardinality: string;
  readonly constraints: Constraints;
  readonly shape: string | null;
}): string | null {
  if (input.title.trim() === "") return "A part needs a title.";
  if (!(PART_CLASSES as readonly string[]).includes(input.class)) {
    return `A part's class is one of ${PART_CLASSES.join(", ")}.`;
  }
  if (!(CARDINALITIES as readonly string[]).includes(input.cardinality)) {
    return `A part's cardinality is one of ${CARDINALITIES.join(", ")}.`;
  }
  if (input.class === "shape" && (input.shape === null || input.shape === "")) return "A part of class shape names the shape it nests.";
  if (input.class !== "shape" && input.shape !== null) return "Only a part of class shape names a shape.";
  const c = input.constraints;
  if (c.aspect !== undefined && !isAspect(c.aspect)) return `aspect is one of ${ASPECTS.join(", ")}.`;
  for (const key of ["maxDurationSeconds", "minWidth", "minHeight"] as const) {
    const value = c[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
      return `${key} is a number above zero.`;
    }
  }
  if (c.formats !== undefined && (!Array.isArray(c.formats) || c.formats.some((format) => typeof format !== "string" || format.trim() === ""))) {
    return "formats is a list of media subtypes.";
  }
  if (input.class === "shape" && Object.keys(c).length > 0) return "A part of class shape takes no constraints.";
  return null;
}

/** The constraints a request carried, keys outside the vocabulary dropped. */
export function constraintsOf(value: unknown): Constraints {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const found: Record<string, unknown> = {};
  for (const key of CONSTRAINT_KEYS) {
    if (source[key] !== undefined && source[key] !== null) found[key] = source[key];
  }
  return found as Constraints;
}

/** A slot as the assignment rule reads it, the index's shape without its bookkeeping. */
export interface SlotFacts {
  readonly key: string;
  readonly title: string;
  readonly class: ContentClass;
  readonly aspect: Aspect | null;
  readonly aspects: readonly Aspect[];
  readonly maxDurationSeconds: number | null;
  readonly formats: readonly string[];
}

/**
 * Whether a part may be assigned to a slot, in words: the classes must be
 * the same, and the part's constraints must be able to meet the slot's — a
 * part fixed at one aspect cannot fill a slot at another, a part allowing a
 * longer duration than the slot cannot promise to fit it, a part whose
 * formats exclude every one the slot takes has nothing to send. A part that
 * constrains nothing may be assigned anywhere its class fits; the projection
 * refuses each item on its own facts. PU_0003_002
 */
export function assignmentRefusal(part: PartRecord, slot: SlotFacts): string | null {
  if (part.class === "shape") return `${part.title} nests a shape and is assigned to a container, not a slot.`;
  if (part.class !== slot.class) return `${slot.title} takes ${slot.class}, and ${part.title} is ${part.class}.`;
  const c = part.constraints;
  const slotAspects = slot.aspects.length > 0 ? slot.aspects : slot.aspect === null ? [] : [slot.aspect];
  if (c.aspect !== undefined && slotAspects.length > 0 && !slotAspects.includes(c.aspect)) {
    return `${slot.title} takes ${slotAspects.join(", ")}, and ${part.title} is fixed at ${c.aspect}.`;
  }
  if (slot.maxDurationSeconds !== null && c.maxDurationSeconds !== undefined && c.maxDurationSeconds > slot.maxDurationSeconds) {
    return `${slot.title} takes at most ${slot.maxDurationSeconds}s, and ${part.title} allows ${c.maxDurationSeconds}s.`;
  }
  if (slot.formats.length > 0 && c.formats !== undefined && c.formats.length > 0) {
    const wanted = slot.formats.map((format) => format.toLowerCase());
    if (!c.formats.some((format) => wanted.includes(format.toLowerCase()))) {
      return `${slot.title} takes ${wanted.join(", ")}, and ${part.title} allows none of them.`;
    }
  }
  return null;
}

/** A field as the binding rule reads it. */
export interface FieldFacts {
  readonly key: string;
  readonly title: string;
  readonly type: "line" | "text" | "date" | "flag" | "reference" | "integer" | "entry";
  readonly many: boolean;
  readonly required: boolean;
}

const ADDRESS = /^[a-z0-9-]+$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[0-9:.]+(Z|[+-]\d{2}:\d{2})?)?$/u;

/**
 * Whether a value a binding carries for a field is one the field's type
 * takes: text for a line or a text, an ISO date, a boolean flag, a whole
 * number, an address or a list of them for a reference, an id or a list for
 * an entry. A required field left empty is the projection's refusal, not the
 * binding's, so a half-written binding can be saved. PU_0003_003
 */
export function fieldValueRefusal(field: FieldFacts, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const one = (candidate: unknown): string | null => {
    switch (field.type) {
      case "line":
      case "text":
        return typeof candidate === "string" ? null : `${field.title} takes text.`;
      case "date":
        return typeof candidate === "string" && ISO_DATE.test(candidate) ? null : `${field.title} takes an ISO-8601 date.`;
      case "flag":
        return typeof candidate === "boolean" ? null : `${field.title} takes true or false.`;
      case "integer":
        return typeof candidate === "number" && Number.isInteger(candidate) ? null : `${field.title} takes a whole number.`;
      case "reference":
        return typeof candidate === "string" && ADDRESS.test(candidate) ? null : `${field.title} takes the address of a record at the site.`;
      case "entry":
        return typeof candidate === "string" && candidate !== "" ? null : `${field.title} takes the id of an entry in its slot.`;
    }
  };
  if (field.many) {
    if (!Array.isArray(value)) return `${field.title} takes a list.`;
    for (const candidate of value) {
      const wrong = one(candidate);
      if (wrong !== null) return wrong;
    }
    return null;
  }
  return one(value);
}
