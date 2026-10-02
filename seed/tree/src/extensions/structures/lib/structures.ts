/**
 * Structures (`calliopa-bootstrap`'s `BO_0299`, made one structure type by `BO_0309`):
 * a block takes structures — a document being the root block of its reading
 * order, a document takes them the same way. A structure *offers* structures, and a
 * block may take a structure offered by a structure on any block above it, to any
 * depth — never one offered by a structure on the block itself. A structure carries fields, and a block that takes the structure
 * holds values in them. The structures are this extension's own nodes and an
 * assignment is a relation, so a rename follows everywhere at once and
 * `documents`' declarations do not change. Client-safe: nothing here reaches
 * the graph.
 *
 * The word *role* is taken on a text block — `text.role` is the typographic
 * role, paragraph or heading — and the graph keeps its stored names: the type
 * `blockRole`, the field node `roleFields` with its `role` property, and the
 * relations `hasBlockRole` and `offers` (`calliopa-bootstrap`'s `BO_0338`). A
 * run's document read keeps answering the typographic one as `role`.
 */

/** The one structure type (`BO_0309`): every structure is a `blockRole` node. */
export const BLOCK_STRUCTURE_TYPE = "blockRole";
/** The type document structures had before `BO_0309`, read only by the migration
 * that turns each into a `blockRole` (`BO_0309_011`). */
export const DOCUMENT_STRUCTURE_TYPE = "documentRole";
/** The node holding one block's values for one structure (`BO_0309_010`). */
export const STRUCTURE_FIELDS_TYPE = "roleFields";

/** The relation types this extension declares. */
export const OFFERS = "offers";
export const HAS_BLOCK_STRUCTURE = "hasBlockRole";
/** A document's structure before `BO_0309`, read only by the migration. */
export const HAS_DOCUMENT_STRUCTURE = "hasDocumentRole";
/** From a `roleFields` node to the block (or document) holding the values. */
export const FIELDS_OF = "fieldsOf";
/** From a `roleFields` node to the structure whose fields they are. */
export const FIELDS_FOR = "fieldsFor";

/** The name a structure is minted with, renamed on its page. */
export const UNNAMED_STRUCTURE = "Untitled structure";
/** The name a field is minted with. */
export const UNNAMED_FIELD = "Untitled field";

/**
 * Every CSL 1.0.2 item type, as *Source*'s *Kind* offers them
 * (`calliopa-bootstrap`'s `BO_0313`): a source is anything cited. What each
 * means, and which a person is offered up front, is `bibliography`'s.
 */
export const CSL_TYPES = [
  "article",
  "article-journal",
  "article-magazine",
  "article-newspaper",
  "bill",
  "book",
  "broadcast",
  "chapter",
  "classic",
  "collection",
  "dataset",
  "document",
  "entry",
  "entry-dictionary",
  "entry-encyclopedia",
  "event",
  "figure",
  "graphic",
  "hearing",
  "interview",
  "legal_case",
  "legislation",
  "manuscript",
  "map",
  "motion_picture",
  "musical_score",
  "pamphlet",
  "paper-conference",
  "patent",
  "performance",
  "periodical",
  "personal_communication",
  "post",
  "post-weblog",
  "regulation",
  "report",
  "review",
  "review-book",
  "software",
  "song",
  "speech",
  "standard",
  "thesis",
  "treaty",
  "webpage",
] as const;

/** *Source*'s release fields (`BO_0313_010`): the CSL record a source
 * document carries, its title being the document's. Authors and editors are
 * one *Family, Given* per line; *Issued* and *Accessed* are text, since CSL
 * allows a year alone. */
export const SOURCE_FIELDS = [
  { key: "kind", name: "Kind", type: "choice", required: true, options: CSL_TYPES },
  { key: "authors", name: "Authors", type: "longText", required: false },
  { key: "editors", name: "Editors", type: "longText", required: false },
  { key: "issued", name: "Issued", type: "text", required: false },
  { key: "container", name: "Container", type: "text", required: false },
  { key: "volume", name: "Volume", type: "text", required: false },
  { key: "issue", name: "Issue", type: "text", required: false },
  { key: "pages", name: "Pages", type: "text", required: false },
  { key: "publisher", name: "Publisher", type: "text", required: false },
  { key: "place", name: "Place", type: "text", required: false },
  { key: "doi", name: "DOI", type: "text", required: false },
  { key: "isbn", name: "ISBN", type: "text", required: false },
  { key: "url", name: "URL", type: "text", required: false },
  { key: "accessed", name: "Accessed", type: "text", required: false },
  { key: "abstract", name: "Abstract", type: "longText", required: false },
  { key: "tags", name: "Tags", type: "text", required: false },
  { key: "file", name: "File", type: "file", required: false },
  { key: "fetched", name: "Fetched", type: "text", required: false },
] as const;

/**
 * What a format makes a picture or a video with (`calliopa-bootstrap`'s
 * `BO_0336`): open fields suggesting from `media`'s sources, read for image
 * and video alone. A *Variation* carries the same four, an empty one meaning
 * its format's. This extension names the sources and knows nothing of what
 * they answer.
 */
export const GENERATION_FIELDS = [
  { key: "provider", name: "Provider", type: "text", required: false, suggest: "media:provider" },
  { key: "model", name: "Model", type: "text", required: false, suggest: "media:model" },
  { key: "ratio", name: "Ratio", type: "text", required: false, suggest: "media:ratio" },
  { key: "quality", name: "Quality", type: "text", required: false, suggest: "media:quality" },
] as const;

/**
 * The built-in structures (`BO_0308_Q5`, `BO_0309_014`): on every instance
 * without being created, never renamed, retired or restored, extended with
 * fields and offered structures like any structure. Their meaning is found by these
 * fixed ids in code, never by name.
 */
export const BUILTIN_STRUCTURES = [
  {
    id: "builtin:keyword",
    name: "Keyword",
    description: "A document that names a concept: its mentions connect to it.",
    blocks: false,
  },
  {
    id: "builtin:profile",
    name: "Instruction",
    description: "A document of reusable instructions for agents.",
    blocks: false,
    // The format a generation under the instruction makes (`BO_0336`). Its
    // id keeps the name the built-in had before `BO_0338`: ids are identity.
    fields: [{ key: "format", name: "Format", type: "reference", required: false, carrying: "builtin:format" }],
  },
  {
    id: "builtin:format",
    name: "Format",
    description: "What a document is produced as.",
    blocks: false,
    fields: [
      { key: "type", name: "Type", type: "choice", required: true, options: ["text", "table", "image", "video", "PDF", "structured"] },
      { key: "schema", name: "Schema", type: "longText", required: false },
      ...GENERATION_FIELDS,
    ],
  },
  {
    id: "builtin:source",
    name: "Source",
    description: "A source that can be cited.",
    blocks: false,
    fields: SOURCE_FIELDS,
  },
  // Offered by *Keyword*, so matching and a keyword's definition keep their
  // meaning with no setting (`calliopa-bootstrap`'s `BO_0310_030`).
  {
    id: "builtin:definition",
    name: "Definition",
    description: "What a keyword means, in the words a reader and a run are given.",
  },
  {
    id: "builtin:alias",
    name: "Alias",
    description: "Other names a keyword answers to, one per line.",
  },
  // Offered by *Format*: a block of a format document naming another way
  // to make it, chosen beside Send (`calliopa-bootstrap`'s `BO_0336`).
  {
    id: "builtin:variation",
    name: "Variation",
    description: "Another way to make a format, chosen beside Send; an empty field is the format's.",
    fields: GENERATION_FIELDS,
  },
] as const;

/** The fields a release declares on a built-in, refused a removal: a
 * person adds fields beside them (`BO_0312_010`, `BO_0313_010`). */
export const releaseFieldsOf = (structureId: string): readonly FieldDeclaration[] => {
  const structure = BUILTIN_STRUCTURES.find((candidate) => candidate.id === structureId);
  return structure !== undefined && "fields" in structure ? (structure.fields as readonly FieldDeclaration[]) : [];
};

/**
 * Whether blocks may take a structure (`calliopa-bootstrap`'s `BO_0332`): a
 * built-in's is the release's, as its name is — *Keyword*, *Profile*,
 * *Format* and *Source* are taken by documents alone — and a person's structure
 * reads its stored `blocks`, absent meaning allowed (`RO_0003_Q1`).
 */
export const blocksAllowed = (structureId: string, stored: unknown): boolean => {
  const structure = BUILTIN_STRUCTURES.find((candidate) => candidate.id === structureId);
  if (structure !== undefined) return !("blocks" in structure) || structure.blocks !== false;
  return stored !== false;
};

/** The built-in source structure (`BO_0313`): a source is a document carrying it. */
export const SOURCE_STRUCTURE = "builtin:source";

/**
 * What a built-in structure's row in *Structures* creates (`BO_0313_011`): a tab kind
 * of the extension that owns the structure's meaning, opened by the row's `+`. A
 * row whose kind no active extension contributes draws none; a row with none
 * creates nothing.
 */
export const BUILTIN_CREATES: Readonly<Record<string, StructureCreate>> = {
  [SOURCE_STRUCTURE]: { kind: "bibliography:new-source", label: "Add source" },
};

/** A built-in row's create action: the kind it opens and its name. */
export interface StructureCreate {
  readonly kind: string;
  readonly label: string;
}

/** The built-in keyword structure and the two it offers (`BO_0310`). */
export const KEYWORD_STRUCTURE = "builtin:keyword";
/** *Instruction*: a document taking it is an instruction, and carries
 * `documents`' `record: instruction` while it takes it, the mark every reader
 * of an instruction keys on (`calliopa-bootstrap`'s `BO_0311_015`, `BO_0338`). */
export const INSTRUCTION_STRUCTURE = "builtin:profile";
export const DEFINITION_STRUCTURE = "builtin:definition";
export const ALIAS_STRUCTURE = "builtin:alias";
/** *Variation*, offered by *Format* (`BO_0336`). */
export const VARIATION_STRUCTURE = "builtin:variation";

/**
 * The offers a release makes between built-ins (`BO_0310_030`): they stand on
 * every instance and are refused a removal, as a built-in is refused a
 * rename. A person offers more beside them.
 */
export const BUILTIN_OFFERS: readonly (readonly [string, string])[] = [
  [KEYWORD_STRUCTURE, DEFINITION_STRUCTURE],
  [KEYWORD_STRUCTURE, ALIAS_STRUCTURE],
  ["builtin:format", VARIATION_STRUCTURE],
];

export const isBuiltinOffer = (from: string, to: string): boolean =>
  BUILTIN_OFFERS.some(([offering, offered]) => offering === from && offered === to);

/** What a fresh *Keyword* sends with a prompt: its definition
 * (`BO_0310_Q2`). Set once, never reset by an upgrade. */
export const DEFAULT_SEND_WITH_PROMPT: readonly string[] = [DEFINITION_STRUCTURE];

export const isBuiltinId = (id: string): boolean => id.startsWith("builtin:");

/** A structure's id as a route or a body names it: a record id, or a built-in's. */
export const isStructureId = (id: string): boolean =>
  /^builtin:[a-z]+$/u.test(id) ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id);

/** The kinds of value a field holds (`BO_0308_Q3`). */
export const FIELD_TYPES = [
  "text",
  "longText",
  "number",
  "date",
  "boolean",
  "choice",
  "reference",
  "file",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Readonly<Record<FieldType, string>> = {
  text: "Text",
  longText: "Long text",
  number: "Number",
  date: "Date",
  boolean: "True/false",
  choice: "Choice",
  reference: "Reference",
  file: "File",
};

export const isFieldType = (value: unknown): value is FieldType =>
  typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value);

/** A file a field holds: what the value names; the live blob reference
 * stands at the top level of the `roleFields` node (`binary-content.md`). */
export interface FileValue {
  readonly hash: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly size: number;
}

/** A value of any field type; `null` is a value cleared. */
export type FieldValue = string | number | boolean | FileValue | null;

/**
 * A field a structure declares (`BO_0309_010`): `key` is minted once and never
 * changes, so a rename keeps every value; `default` is filled in when a
 * block takes the structure (`BO_0318_Q8`).
 */
export interface FieldDeclaration {
  readonly key: string;
  readonly name: string;
  readonly type: FieldType;
  readonly required: boolean;
  /** A choice's options, in order. */
  readonly options?: readonly string[];
  readonly default?: FieldValue;
  /** A text field's source of suggestions, `<extension>:<name>`, answered
   * by that extension through the frame (`BO_0336_010`). */
  readonly suggest?: string;
  /** A text field's own words to suggest, typed on the structure's page. */
  readonly suggestions?: readonly string[];
  /** A reference field's structure: it takes, and suggests by title, only
   * documents carrying it (`BO_0336_011`). */
  readonly carrying?: string;
}

/** A suggestion source as a field names it: `<extension>:<name>`. */
export const isSourceName = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9.-]*:[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(value);

/** Words to suggest as stored: trimmed, no blanks, no repeats. */
export const cleanWords = (words: readonly string[]): string[] =>
  [...new Set(words.map((word) => word.trim()).filter((word) => word !== ""))];

/** The built-in *Format* structure (`calliopa-bootstrap`'s `BO_0312`). */
export const FORMAT_STRUCTURE = "builtin:format";

/** Whether a field is one a release declares on a built-in structure
 * (`releaseFieldsOf`): refused a removal and a change of its type or options,
 * drawn fixed on the structure page; a person adds fields beside it. */
export const isBuiltinField = (structureId: string, key: string): boolean =>
  releaseFieldsOf(structureId).some((field) => field.key === key);

/**
 * A field's key, minted once from the name it is first given and never
 * changed (`BO_0309_010`): the words in camel case, ASCII letters and digits
 * alone, numbered when the structure already holds the key. So *Citation style*
 * is `citationStyle`, which a reader such as `manuscripts` looks a value up
 * by, and a rename keeps it.
 */
export function mintFieldKey(name: string, taken: readonly string[]): string {
  const words = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/gu, " ")
    .trim()
    .split(" ")
    .filter((word) => word !== "");
  const joined = words
    .map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join("");
  const base = joined === "" || /^[0-9]/u.test(joined) ? `field${joined}` : joined;
  if (!taken.includes(base)) return base;
  let at = 2;
  while (taken.includes(`${base}${at}`)) at += 1;
  return `${base}${at}`;
}

/** A structure as the catalogue lists it. */
export interface StructureView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Retired, never deleted: nothing offers it any more, assignments stay
   * and say so (`BO_0299_Q4`). */
  readonly retired: boolean;
  readonly builtin: boolean;
  /** The place among the structures, the person's own order. */
  readonly order: number;
  readonly fields: readonly FieldDeclaration[];
  /** The structures this structure offers, by id, in the catalogue's order. */
  readonly offers: readonly string[];
  /** The structures offering this one, by id. A structure nobody offers can be taken
   * on any block (`BO_0309_Q1`). */
  readonly offeredBy: readonly string[];
  /** The id the structure had as a document structure before `BO_0309`, when it had
   * one: a reader still holding the old id finds the structure by it. */
  readonly formerId?: string;
  /** On *Keyword* alone (`BO_0310_031`): the field keys and offered structures
   * whose words go with a prompt that includes a keyword. */
  readonly sendWithPrompt?: readonly string[];
  /** On a built-in whose owner contributes it (`BO_0313_011`): what the
   * row's `+` opens. */
  readonly create?: StructureCreate;
  /** Whether blocks may take it; the document always may (`BO_0332`). */
  readonly blocks: boolean;
}

/** A structure a block (or document) takes, with its values. */
export interface TakenStructure {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly retired: boolean;
  readonly builtin: boolean;
  /** Whether the block could take it now: a structure taken while its offering
   * structure stood above stays, and says it is not offered (`BO_0299_Q3`). */
  readonly offered: boolean;
  readonly fields: readonly FieldDeclaration[];
  readonly values: Readonly<Record<string, FieldValue>>;
  /** The required keys holding no value (`BO_0308_Q3`). */
  readonly missing: readonly string[];
  /** A run proposed this structure, or a value of it, in an open group: the
   * label says so until the person answers (`BO_0309_Q4`). */
  readonly proposed?: "structure" | "values";
  /** On *Keyword* alone, as the catalogue answers it (`BO_0310_031`). */
  readonly sendWithPrompt?: readonly string[];
  /** Whether blocks may take it (`BO_0332`). */
  readonly blocks: boolean;
  /** Taken on a block although blocks may not take it — carried before the
   * structure became the document's alone. It stays and says so (`RO_0003_Q3`). */
  readonly notOnBlock?: true;
}

/** One block in reading order, the block it stands under, and its structures. */
export interface StructuredBlock {
  readonly blockId: string;
  readonly kind: string;
  /** The block it stands in — a callout for its children — or null for a
   * block standing in the document itself. */
  readonly parentId: string | null;
  readonly structures: readonly TakenStructure[];
  /** The structures this block may take where it stands, by id. */
  readonly takeable: readonly string[];
}

/**
 * What another extension, the browser and a run read: the document's own
 * structures and each block's, in reading order, at the data revision it was
 * read at (`BO_0299_016`, widened by `BO_0309_012`).
 */
export interface DocumentStructuresView {
  readonly documentId: string;
  readonly dataRevision: number;
  readonly structures: readonly TakenStructure[];
  readonly takeable: readonly string[];
  readonly blocks: readonly StructuredBlock[];
  /** The structures standing above the document when it is a block's focused
   * work: the structures of the block it was opened from, of the callout and the
   * document that block stands in, and on up while that document is focused
   * work in turn — nearest first. They offer their structures to this document
   * and its blocks as structures above a block do. */
  readonly inherited: readonly InheritedStructure[];
  /** What each reference value of the document's own structures names, by the
   * node id the value holds: a document's title, or a block's first words.
   * A value naming nothing that reads is absent. The header's values line
   * shows these (`DO_0030_005`). */
  readonly referenceTitles?: Readonly<Record<string, string>>;
}

/** A structure standing above a document, and where it is carried. */
export interface InheritedStructure {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The block (or document) carrying it. */
  readonly on: string;
  /** The document that block stands in. */
  readonly document: string;
}

/** What the Structures section and the controls are handed: the catalogue, or
 * that the graph did not answer. */
export interface StructuresListing {
  readonly reachable: boolean;
  readonly structures: readonly StructureView[];
}

const byOrder = (left: StructureView, right: StructureView): number =>
  Number(right.builtin) - Number(left.builtin) ||
  left.order - right.order ||
  left.name.localeCompare(right.name);

/** The catalogue in the person's order, the built-ins first. */
export function inOrder(structures: readonly StructureView[]): readonly StructureView[] {
  return [...structures].sort(byOrder);
}

/**
 * The structures a subject may take (`BO_0309_012`, `BO_0309_Q1`): every
 * unretired structure no structure offers, and every unretired structure offered by a structure
 * taken on a block above it. `above` is the structures of every block over the
 * subject, the document's included for a block, and nothing for the
 * document: a structure is offered to the blocks under its block, never to the
 * block carrying it. A block never takes a structure blocks may not take, offered
 * or not; the document does (`BO_0332`, `RO_0003_Q5`).
 */
export function takeableFrom(
  structures: readonly StructureView[],
  above: Iterable<string>,
  onBlock: boolean,
): readonly string[] {
  const byId = new Map(structures.map((structure) => [structure.id, structure] as const));
  const offered = new Set<string>();
  for (const id of above)
    for (const target of byId.get(id)?.offers ?? []) offered.add(target);
  return inOrder(structures)
    .filter(
      (structure) =>
        !structure.retired &&
        (!onBlock || structure.blocks) &&
        (structure.offeredBy.length === 0 || offered.has(structure.id)),
    )
    .map((structure) => structure.id);
}

/** Whether a value counts as held: an empty text or a cleared value does not. */
export const isHeld = (value: FieldValue | undefined): boolean =>
  value !== undefined && value !== null && value !== "";

/** The required keys a structure's values leave empty. */
export function missingOf(
  fields: readonly FieldDeclaration[],
  values: Readonly<Record<string, FieldValue>>,
): readonly string[] {
  return fields
    .filter((field) => field.required && !isHeld(values[field.key]))
    .map((field) => field.key);
}

/** The values a structure's defaults fill in when a block takes it (`BO_0318_Q8`). */
export function defaultsOf(
  fields: readonly FieldDeclaration[],
): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of fields)
    if (field.default !== undefined && isHeld(field.default))
      values[field.key] = field.default;
  return values;
}

const isFileValue = (value: unknown): value is FileValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["hash"] === "string" &&
    typeof candidate["filename"] === "string" &&
    typeof candidate["mediaType"] === "string" &&
    typeof candidate["size"] === "number"
  );
};

/**
 * A value read against its field's type, or why it is not one. `null`
 * clears. A reference names a record id; whether it exists is the server's
 * to say.
 */
export function valueFor(
  field: FieldDeclaration,
  value: unknown,
): { value: FieldValue } | { failure: string } {
  if (value === null) return { value: null };
  const wrong = { failure: `${field.name} holds ${FIELD_TYPE_LABELS[field.type].toLowerCase()}.` };
  switch (field.type) {
    case "text":
    case "longText":
      return typeof value === "string" ? { value } : wrong;
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? { value }
        : wrong;
    case "date":
      return typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
        ? { value }
        : { failure: `${field.name} holds a date as YYYY-MM-DD.` };
    case "boolean":
      return typeof value === "boolean" ? { value } : wrong;
    case "choice":
      return typeof value === "string" && (field.options ?? []).includes(value)
        ? { value }
        : {
            failure: `${field.name} is one of ${(field.options ?? []).join(", ") || "no options yet"}.`,
          };
    case "reference":
      return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
        ? { value }
        : { failure: `${field.name} names a document or a block by its id.` };
    case "file":
      return isFileValue(value)
        ? { value }
        : { failure: `${field.name} holds an uploaded file.` };
  }
}

/** A field declaration read from stored content, or null when it is not one. */
export function fieldOf(value: unknown): FieldDeclaration | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const candidate = value as Record<string, unknown>;
  const key = candidate["key"];
  const name = candidate["name"];
  const type = candidate["type"];
  if (typeof key !== "string" || key === "" || typeof name !== "string")
    return null;
  if (!isFieldType(type)) return null;
  const options = Array.isArray(candidate["options"])
    ? candidate["options"].filter(
        (option): option is string => typeof option === "string",
      )
    : undefined;
  const suggest = candidate["suggest"];
  const suggestions = Array.isArray(candidate["suggestions"])
    ? cleanWords(candidate["suggestions"].filter((word): word is string => typeof word === "string"))
    : [];
  const carrying = candidate["carrying"];
  const field: FieldDeclaration = {
    key,
    name,
    type,
    required: candidate["required"] === true,
    ...(options === undefined ? {} : { options }),
    ...(type === "text" && isSourceName(suggest) ? { suggest } : {}),
    ...(type === "text" && suggestions.length > 0 ? { suggestions } : {}),
    ...(type === "reference" && typeof carrying === "string" && isStructureId(carrying) ? { carrying } : {}),
  };
  const fallback = candidate["default"];
  if (fallback === undefined) return field;
  const read = valueFor(field, fallback);
  return "value" in read && read.value !== null
    ? { ...field, default: read.value }
    : field;
}

/** What a label says of a taken structure beside its name, or nothing. A block
 * keeping a structure blocks may not take says so (`RO_0003_Q3`). */
export function structureState(
  structure: TakenStructure,
): "retired" | "not allowed on a block" | "not allowed here" | null {
  if (structure.retired) return "retired";
  if (structure.notOnBlock === true) return "not allowed on a block";
  if (!structure.offered) return "not allowed here";
  return null;
}

/** A value as a person reads it. */
export function shownValue(field: FieldDeclaration, value: FieldValue | undefined): string {
  if (!isHeld(value)) return "";
  if (field.type === "boolean") return value === true ? "Yes" : "No";
  if (field.type === "file" && typeof value === "object" && value !== null)
    return value.filename;
  return String(value);
}
