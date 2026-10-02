/**
 * Roles (`calliopa-bootstrap`'s `BO_0299`, made one role type by `BO_0309`):
 * a block takes roles — a document being the root block of its reading
 * order, a document takes them the same way. A role *offers* roles, and a
 * block may take a role offered by a role on any block above it, to any
 * depth — never one offered by a role on the block itself. A role carries fields, and a block that takes the role
 * holds values in them. The roles are this extension's own nodes and an
 * assignment is a relation, so a rename follows everywhere at once and
 * `documents`' declarations do not change. Client-safe: nothing here reaches
 * the graph.
 *
 * The word *role* is taken on a text block — `text.role` is the typographic
 * role, paragraph or heading — so the type keeps the name `blockRole` and a
 * run's document read keeps answering the typographic one as `role`.
 */

/** The one role type (`BO_0309`): every role is a `blockRole` node. */
export const BLOCK_ROLE_TYPE = "blockRole";
/** The type document roles had before `BO_0309`, read only by the migration
 * that turns each into a `blockRole` (`BO_0309_011`). */
export const DOCUMENT_ROLE_TYPE = "documentRole";
/** The node holding one block's values for one role (`BO_0309_010`). */
export const ROLE_FIELDS_TYPE = "roleFields";

/** The relation types this extension declares. */
export const OFFERS = "offers";
export const HAS_BLOCK_ROLE = "hasBlockRole";
/** A document's role before `BO_0309`, read only by the migration. */
export const HAS_DOCUMENT_ROLE = "hasDocumentRole";
/** From a `roleFields` node to the block (or document) holding the values. */
export const FIELDS_OF = "fieldsOf";
/** From a `roleFields` node to the role whose fields they are. */
export const FIELDS_FOR = "fieldsFor";

/** The name a role is minted with, renamed on its page. */
export const UNNAMED_ROLE = "Untitled role";
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
 * The built-in roles (`BO_0308_Q5`, `BO_0309_014`): on every instance
 * without being created, never renamed, retired or restored, extended with
 * fields and offered roles like any role. Their meaning is found by these
 * fixed ids in code, never by name.
 */
export const BUILTIN_ROLES = [
  {
    id: "builtin:keyword",
    name: "Keyword",
    description: "A document that names a concept: its mentions connect to it.",
    blocks: false,
  },
  {
    id: "builtin:profile",
    name: "Profile",
    description: "A document of reusable instructions for agents.",
    blocks: false,
  },
  {
    id: "builtin:format",
    name: "Format",
    description: "What a document is produced as.",
    blocks: false,
    fields: [
      { key: "type", name: "Type", type: "choice", required: true, options: ["text", "table", "image", "video", "PDF", "structured"] },
      { key: "schema", name: "Schema", type: "longText", required: false },
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
] as const;

/** The fields a release declares on a built-in, refused a removal: a
 * person adds fields beside them (`BO_0312_010`, `BO_0313_010`). */
export const releaseFieldsOf = (roleId: string): readonly FieldDeclaration[] => {
  const role = BUILTIN_ROLES.find((candidate) => candidate.id === roleId);
  return role !== undefined && "fields" in role ? (role.fields as readonly FieldDeclaration[]) : [];
};

/**
 * Whether blocks may take a role (`calliopa-bootstrap`'s `BO_0332`): a
 * built-in's is the release's, as its name is — *Keyword*, *Profile*,
 * *Format* and *Source* are taken by documents alone — and a person's role
 * reads its stored `blocks`, absent meaning allowed (`RO_0003_Q1`).
 */
export const blocksAllowed = (roleId: string, stored: unknown): boolean => {
  const role = BUILTIN_ROLES.find((candidate) => candidate.id === roleId);
  if (role !== undefined) return !("blocks" in role) || role.blocks !== false;
  return stored !== false;
};

/** The built-in source role (`BO_0313`): a source is a document carrying it. */
export const SOURCE_ROLE = "builtin:source";

/**
 * What a built-in role's row in *Roles* creates (`BO_0313_011`): a tab kind
 * of the extension that owns the role's meaning, opened by the row's `+`. A
 * row whose kind no active extension contributes draws none; a row with none
 * creates nothing.
 */
export const BUILTIN_CREATES: Readonly<Record<string, RoleCreate>> = {
  [SOURCE_ROLE]: { kind: "bibliography:new-source", label: "Add source" },
};

/** A built-in row's create action: the kind it opens and its name. */
export interface RoleCreate {
  readonly kind: string;
  readonly label: string;
}

/** The built-in keyword role and the two it offers (`BO_0310`). */
export const KEYWORD_ROLE = "builtin:keyword";
/** *Profile*: a document taking it is a profile, and carries `documents`'
 * `record: profile` while it takes it, the mark every reader of a profile
 * keys on (`calliopa-bootstrap`'s `BO_0311_015`). */
export const PROFILE_ROLE = "builtin:profile";
export const DEFINITION_ROLE = "builtin:definition";
export const ALIAS_ROLE = "builtin:alias";

/**
 * The offers a release makes between built-ins (`BO_0310_030`): they stand on
 * every instance and are refused a removal, as a built-in is refused a
 * rename. A person offers more beside them.
 */
export const BUILTIN_OFFERS: readonly (readonly [string, string])[] = [
  [KEYWORD_ROLE, DEFINITION_ROLE],
  [KEYWORD_ROLE, ALIAS_ROLE],
];

export const isBuiltinOffer = (from: string, to: string): boolean =>
  BUILTIN_OFFERS.some(([offering, offered]) => offering === from && offered === to);

/** What a fresh *Keyword* sends with a prompt: its definition
 * (`BO_0310_Q2`). Set once, never reset by an upgrade. */
export const DEFAULT_SEND_WITH_PROMPT: readonly string[] = [DEFINITION_ROLE];

export const isBuiltinId = (id: string): boolean => id.startsWith("builtin:");

/** A role's id as a route or a body names it: a record id, or a built-in's. */
export const isRoleId = (id: string): boolean =>
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
 * A field a role declares (`BO_0309_010`): `key` is minted once and never
 * changes, so a rename keeps every value; `default` is filled in when a
 * block takes the role (`BO_0318_Q8`).
 */
export interface FieldDeclaration {
  readonly key: string;
  readonly name: string;
  readonly type: FieldType;
  readonly required: boolean;
  /** A choice's options, in order. */
  readonly options?: readonly string[];
  readonly default?: FieldValue;
}

/** The built-in *Format* role (`calliopa-bootstrap`'s `BO_0312`). */
export const FORMAT_ROLE = "builtin:format";

/** Whether a field is one a release declares on a built-in role
 * (`releaseFieldsOf`): refused a removal and a change of its type or options,
 * drawn fixed on the role page; a person adds fields beside it. */
export const isBuiltinField = (roleId: string, key: string): boolean =>
  releaseFieldsOf(roleId).some((field) => field.key === key);

/**
 * A field's key, minted once from the name it is first given and never
 * changed (`BO_0309_010`): the words in camel case, ASCII letters and digits
 * alone, numbered when the role already holds the key. So *Citation style*
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

/** A role as the catalogue lists it. */
export interface RoleView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Retired, never deleted: nothing offers it any more, assignments stay
   * and say so (`BO_0299_Q4`). */
  readonly retired: boolean;
  readonly builtin: boolean;
  /** The place among the roles, the person's own order. */
  readonly order: number;
  readonly fields: readonly FieldDeclaration[];
  /** The roles this role offers, by id, in the catalogue's order. */
  readonly offers: readonly string[];
  /** The roles offering this one, by id. A role nobody offers can be taken
   * on any block (`BO_0309_Q1`). */
  readonly offeredBy: readonly string[];
  /** The id the role had as a document role before `BO_0309`, when it had
   * one: a reader still holding the old id finds the role by it. */
  readonly formerId?: string;
  /** On *Keyword* alone (`BO_0310_031`): the field keys and offered roles
   * whose words go with a prompt that includes a keyword. */
  readonly sendWithPrompt?: readonly string[];
  /** On a built-in whose owner contributes it (`BO_0313_011`): what the
   * row's `+` opens. */
  readonly create?: RoleCreate;
  /** Whether blocks may take it; the document always may (`BO_0332`). */
  readonly blocks: boolean;
}

/** A role a block (or document) takes, with its values. */
export interface TakenRole {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly retired: boolean;
  readonly builtin: boolean;
  /** Whether the block could take it now: a role taken while its offering
   * role stood above stays, and says it is not offered (`BO_0299_Q3`). */
  readonly offered: boolean;
  readonly fields: readonly FieldDeclaration[];
  readonly values: Readonly<Record<string, FieldValue>>;
  /** The required keys holding no value (`BO_0308_Q3`). */
  readonly missing: readonly string[];
  /** A run proposed this role, or a value of it, in an open group: the
   * label says so until the person answers (`BO_0309_Q4`). */
  readonly proposed?: "role" | "values";
  /** On *Keyword* alone, as the catalogue answers it (`BO_0310_031`). */
  readonly sendWithPrompt?: readonly string[];
  /** Whether blocks may take it (`BO_0332`). */
  readonly blocks: boolean;
  /** Taken on a block although blocks may not take it — carried before the
   * role became the document's alone. It stays and says so (`RO_0003_Q3`). */
  readonly notOnBlock?: true;
}

/** One block in reading order, the block it stands under, and its roles. */
export interface RoledBlock {
  readonly blockId: string;
  readonly kind: string;
  /** The block it stands in — a callout for its children — or null for a
   * block standing in the document itself. */
  readonly parentId: string | null;
  readonly roles: readonly TakenRole[];
  /** The roles this block may take where it stands, by id. */
  readonly takeable: readonly string[];
}

/**
 * What another extension, the browser and a run read: the document's own
 * roles and each block's, in reading order, at the data revision it was
 * read at (`BO_0299_016`, widened by `BO_0309_012`).
 */
export interface DocumentRolesView {
  readonly documentId: string;
  readonly dataRevision: number;
  readonly roles: readonly TakenRole[];
  readonly takeable: readonly string[];
  readonly blocks: readonly RoledBlock[];
  /** The roles standing above the document when it is a block's focused
   * work: the roles of the block it was opened from, of the callout and the
   * document that block stands in, and on up while that document is focused
   * work in turn — nearest first. They offer their roles to this document
   * and its blocks as roles above a block do. */
  readonly inherited: readonly InheritedRole[];
  /** What each reference value of the document's own roles names, by the
   * node id the value holds: a document's title, or a block's first words.
   * A value naming nothing that reads is absent. The header's values line
   * shows these (`DO_0030_005`). */
  readonly referenceTitles?: Readonly<Record<string, string>>;
}

/** A role standing above a document, and where it is carried. */
export interface InheritedRole {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The block (or document) carrying it. */
  readonly on: string;
  /** The document that block stands in. */
  readonly document: string;
}

/** What the Roles section and the controls are handed: the catalogue, or
 * that the graph did not answer. */
export interface RolesListing {
  readonly reachable: boolean;
  readonly roles: readonly RoleView[];
}

const byOrder = (left: RoleView, right: RoleView): number =>
  Number(right.builtin) - Number(left.builtin) ||
  left.order - right.order ||
  left.name.localeCompare(right.name);

/** The catalogue in the person's order, the built-ins first. */
export function inOrder(roles: readonly RoleView[]): readonly RoleView[] {
  return [...roles].sort(byOrder);
}

/**
 * The roles a subject may take (`BO_0309_012`, `BO_0309_Q1`): every
 * unretired role no role offers, and every unretired role offered by a role
 * taken on a block above it. `above` is the roles of every block over the
 * subject, the document's included for a block, and nothing for the
 * document: a role is offered to the blocks under its block, never to the
 * block carrying it. A block never takes a role blocks may not take, offered
 * or not; the document does (`BO_0332`, `RO_0003_Q5`).
 */
export function takeableFrom(
  roles: readonly RoleView[],
  above: Iterable<string>,
  onBlock: boolean,
): readonly string[] {
  const byId = new Map(roles.map((role) => [role.id, role] as const));
  const offered = new Set<string>();
  for (const id of above)
    for (const target of byId.get(id)?.offers ?? []) offered.add(target);
  return inOrder(roles)
    .filter(
      (role) =>
        !role.retired &&
        (!onBlock || role.blocks) &&
        (role.offeredBy.length === 0 || offered.has(role.id)),
    )
    .map((role) => role.id);
}

/** Whether a value counts as held: an empty text or a cleared value does not. */
export const isHeld = (value: FieldValue | undefined): boolean =>
  value !== undefined && value !== null && value !== "";

/** The required keys a role's values leave empty. */
export function missingOf(
  fields: readonly FieldDeclaration[],
  values: Readonly<Record<string, FieldValue>>,
): readonly string[] {
  return fields
    .filter((field) => field.required && !isHeld(values[field.key]))
    .map((field) => field.key);
}

/** The values a role's defaults fill in when a block takes it (`BO_0318_Q8`). */
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
  const field: FieldDeclaration = {
    key,
    name,
    type,
    required: candidate["required"] === true,
    ...(options === undefined ? {} : { options }),
  };
  const fallback = candidate["default"];
  if (fallback === undefined) return field;
  const read = valueFor(field, fallback);
  return "value" in read && read.value !== null
    ? { ...field, default: read.value }
    : field;
}

/** What a label says of a taken role beside its name, or nothing. A block
 * keeping a role blocks may not take says so (`RO_0003_Q3`). */
export function roleState(
  role: TakenRole,
): "retired" | "not allowed on a block" | "not offered" | null {
  if (role.retired) return "retired";
  if (role.notOnBlock === true) return "not allowed on a block";
  if (!role.offered) return "not offered";
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
