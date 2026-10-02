import { CSL_TYPES, type FieldValue, type FileValue } from "~/extensions/doc-block-roles/lib/roles";

/**
 * The bibliography's vocabulary (`BO_0291_015`, reshaped by `BO_0313`): a
 * source is a document carrying *Source* and `record: source`, of any CSL
 * type — a paper, a web page, an interview, a dataset — its title the
 * document's and the rest of its record *Source*'s fields. The record is
 * CSL-JSON in shape, the shape a DOI resolves to, the engine exports and the
 * citation processor consumes, and the identifier is the identity for
 * duplicates. Shared by the server and the surfaces, so a record is judged
 * one way everywhere. The names keep *work*: a citation's run says
 * `cite: {work}` and renaming it would break every stored run.
 */

/** The type every source was before `BO_0313`, read only by the migration
 * that makes each a source document (`BO_0313_023`). */
export const WORK_TYPE = "work";

/** The `record` a source document carries, so the kernel tells it apart
 * without the roles' vocabulary (`calliopa-bootstrap`'s `BO_0313_001`). */
export const SOURCE_RECORD = "source";

/** Every CSL type is a source's kind (`BO_0313`). */
export const WORK_KINDS = CSL_TYPES;
export type WorkKind = (typeof WORK_KINDS)[number];

export const isWorkKind = (value: unknown): value is WorkKind => WORK_KINDS.includes(value as WorkKind);

/** What the add form offers up front, every other type behind *More*
 * (`BO_0313_Q2`): paper, book, web page, interview, conversation, dataset,
 * software and report. */
export const FRONT_KINDS: readonly WorkKind[] = [
  "article-journal",
  "book",
  "webpage",
  "interview",
  "personal_communication",
  "dataset",
  "software",
  "report",
];

/** A kind as a person reads it: the eight up front in their own words, the
 * rest as CSL names them, made readable. */
const KIND_WORDS: Readonly<Partial<Record<WorkKind, string>>> = {
  "article-journal": "Paper",
  book: "Book",
  webpage: "Web page",
  interview: "Interview",
  personal_communication: "Conversation",
  dataset: "Dataset",
  software: "Software",
  report: "Report",
  chapter: "Book chapter",
  "paper-conference": "Conference paper",
  "post-weblog": "Blog post",
  legal_case: "Legal case",
  motion_picture: "Film",
  musical_score: "Musical score",
};

export const kindWords = (kind: WorkKind): string => {
  const known = KIND_WORDS[kind];
  if (known !== undefined) return known;
  const spaced = kind.replace(/[-_]/gu, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** A CSL name: a person (`family`, `given`) or an institution (`literal`). */
export interface WorkName {
  readonly family?: string;
  readonly given?: string;
  readonly literal?: string;
}

/** A CSL date: `date-parts` as `[[year, month?, day?]]`, or a `raw` string. */
export interface WorkDate {
  readonly "date-parts"?: readonly (readonly (number | string)[])[];
  readonly raw?: string;
}

/** The fields the declaration permits beside `title` and `kind`. */
export const WORK_FIELDS = [
  "author",
  "editor",
  "issued",
  "container-title",
  "volume",
  "issue",
  "page",
  "publisher",
  "publisher-place",
  "DOI",
  "ISBN",
  "URL",
  "accessed",
  "abstract",
  "tags",
  "fetched",
  "file",
] as const;

/** What answered the record, when, and from which identifier. */
export interface Fetched {
  readonly by: string;
  readonly at: string;
  readonly from: string;
}

/** The record a work stores: CSL-JSON with `kind` in place of CSL's `type`. */
export interface WorkRecord {
  readonly title: string;
  readonly kind: WorkKind;
  readonly author?: readonly WorkName[];
  readonly editor?: readonly WorkName[];
  readonly issued?: WorkDate;
  readonly "container-title"?: string;
  readonly volume?: string;
  readonly issue?: string;
  readonly page?: string;
  readonly publisher?: string;
  readonly "publisher-place"?: string;
  readonly DOI?: string;
  readonly ISBN?: string;
  readonly URL?: string;
  readonly accessed?: WorkDate;
  readonly abstract?: string;
  readonly tags?: readonly string[];
  readonly fetched?: Fetched;
  /** The work's own file, the core's blob reference with its media type. */
  readonly file?: Readonly<Record<string, unknown>>;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): value is string => typeof value === "string";

function readNames(value: unknown, field: string): { readonly names: WorkName[] } | { readonly failure: string } {
  if (!Array.isArray(value)) return { failure: `A source's ${field} is a list of names.` };
  const names: WorkName[] = [];
  for (const entry of value) {
    const name = record(entry);
    if (name === null) return { failure: `A source's ${field} is a list of names.` };
    const family = name["family"];
    const given = name["given"];
    const literal = name["literal"];
    if ((family !== undefined && !text(family)) || (given !== undefined && !text(given)) || (literal !== undefined && !text(literal))) {
      return { failure: `A name in a source's ${field} carries family, given or literal, as words.` };
    }
    if (family === undefined && literal === undefined) {
      return { failure: `A name in a source's ${field} carries a family name or a literal.` };
    }
    names.push({
      ...(family !== undefined ? { family } : {}),
      ...(given !== undefined ? { given } : {}),
      ...(literal !== undefined ? { literal } : {}),
    });
  }
  return { names };
}

function readDate(value: unknown, field: string): { readonly date: WorkDate } | { readonly failure: string } {
  const date = record(value);
  if (date === null) return { failure: `A source's ${field} is a date: date-parts or raw.` };
  const parts = date["date-parts"];
  const raw = date["raw"];
  if (parts === undefined && raw === undefined) return { failure: `A source's ${field} is a date: date-parts or raw.` };
  if (raw !== undefined && !text(raw)) return { failure: `A source's ${field} raw date is words.` };
  if (parts !== undefined) {
    if (!Array.isArray(parts) || !parts.every((part) => Array.isArray(part) && part.length >= 1 && part.length <= 3 && part.every((p: unknown) => typeof p === "number" || text(p)))) {
      return { failure: `A source's ${field} date-parts are [[year, month, day]].` };
    }
  }
  return { date: { ...(parts !== undefined ? { "date-parts": parts as NonNullable<WorkDate["date-parts"]> } : {}), ...(raw !== undefined ? { raw } : {}) } };
}

/**
 * Reads an untrusted value as a work's record, or says why it is not one:
 * `title` and a permitted `kind` required, every other field permitted by
 * name and in its shape, nothing else.
 */
export function readWorkRecord(value: unknown): { readonly record: WorkRecord } | { readonly failure: string } {
  const content = record(value);
  if (content === null) return { failure: "A source carries a record." };
  const title = content["title"];
  if (!text(title) || title.trim() === "") return { failure: "A source carries a title." };
  const kind = content["kind"];
  if (!isWorkKind(kind)) return { failure: `A source's kind is one of ${WORK_KINDS.join(", ")}.` };
  const out: Record<string, unknown> = { title, kind };
  for (const key of Object.keys(content)) {
    if (key === "title" || key === "kind") continue;
    if (!(WORK_FIELDS as readonly string[]).includes(key)) return { failure: `A source carries no ${key}.` };
    const field = content[key];
    if (field === undefined || field === null) continue;
    if (key === "author" || key === "editor") {
      const names = readNames(field, key);
      if ("failure" in names) return names;
      out[key] = names.names;
    } else if (key === "issued" || key === "accessed") {
      const date = readDate(field, key);
      if ("failure" in date) return date;
      out[key] = date.date;
    } else if (key === "tags") {
      if (!Array.isArray(field) || !field.every(text)) return { failure: "A source's tags are words." };
      out[key] = field;
    } else if (key === "fetched") {
      const fetched = record(field);
      if (fetched === null || !text(fetched["by"]) || !text(fetched["at"]) || !text(fetched["from"])) {
        return { failure: "A source's fetched says by whom, when and from which identifier." };
      }
      out[key] = { by: fetched["by"], at: fetched["at"], from: fetched["from"] };
    } else if (key === "file") {
      const file = record(field);
      if (file === null) return { failure: "A source's file is the core's blob reference." };
      out[key] = file;
    } else {
      if (!text(field)) return { failure: `A source's ${key} is words.` };
      if (field.trim() !== "") out[key] = field;
    }
  }
  return { record: out as unknown as WorkRecord };
}

/** The identifiers a record carries, normalized, as the identity for duplicates. */
export function identifiersOf(record: Pick<WorkRecord, "DOI" | "ISBN" | "URL">): { readonly kind: "DOI" | "ISBN" | "URL"; readonly value: string }[] {
  const out: { readonly kind: "DOI" | "ISBN" | "URL"; readonly value: string }[] = [];
  if (record.DOI !== undefined) out.push({ kind: "DOI", value: normalizeDoi(record.DOI) });
  if (record.ISBN !== undefined) out.push({ kind: "ISBN", value: normalizeIsbn(record.ISBN) });
  if (record.URL !== undefined) out.push({ kind: "URL", value: normalizeUrl(record.URL) });
  return out;
}

export const normalizeDoi = (doi: string): string =>
  doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//iu, "")
    .replace(/^doi:/iu, "")
    .toLowerCase();

/** ISBNs come with hyphens and spaces; the digits are the identity. A record
 * may carry several separated by spaces or commas; the first is the identity. */
export const normalizeIsbn = (isbn: string): string => {
  const first = isbn.trim().split(/[\s,;]+/u)[0] ?? "";
  return first.replace(/[-\s]/gu, "").toUpperCase();
};

export const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/u, "");
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim();
  }
};

/** The one work among `works` sharing an identifier with `record`, if any. */
export function duplicateOf<T extends { readonly record: Pick<WorkRecord, "DOI" | "ISBN" | "URL"> }>(record: Pick<WorkRecord, "DOI" | "ISBN" | "URL">, works: readonly T[]): T | undefined {
  const mine = identifiersOf(record);
  if (mine.length === 0) return undefined;
  return works.find((work) => {
    const theirs = identifiersOf(work.record);
    return mine.some((id) => theirs.some((other) => other.kind === id.kind && other.value === id.value));
  });
}

/**
 * A CSL-JSON item as the engine exports it, read as a source's record: CSL's
 * `type` becomes `kind` and keeps the record's own type (`BO_0313`), its `id`
 * (the engine's key) is dropped, the fields a record holds are kept and
 * everything else is left behind. Only a type CSL does not name reads as
 * `document`.
 */
export function recordFromCsl(item: Record<string, unknown>, fetched: Fetched): { readonly record: WorkRecord } | { readonly failure: string } {
  const type = item["type"];
  const kind: WorkKind = isWorkKind(type) ? type : "document";
  const candidate: Record<string, unknown> = { kind, fetched };
  for (const key of WORK_FIELDS) {
    if (key === "fetched" || key === "file" || key === "tags") continue;
    if (item[key] !== undefined) candidate[key] = item[key];
  }
  if (typeof item["title"] === "string") candidate["title"] = item["title"];
  const read = readWorkRecord(candidate);
  return read;
}

/**
 * The name a `work` node stored a record field under (found 2026-09-23),
 * read by the migration alone: the Cypher dialect
 * has no quoted identifiers, so CSL's two hyphenated keys cannot be written
 * as property names and are stored in camel case; every other key is stored
 * as it is. The record keeps CSL's own keys everywhere else, so the mapping
 * lives at the write and the read and nowhere between.
 */
const STORED: Readonly<Record<string, string>> = { "container-title": "containerTitle", "publisher-place": "publisherPlace" };
const READ: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(STORED).map(([csl, stored]) => [stored, csl]));

export const storedKey = (key: string): string => STORED[key] ?? key;
export const recordKey = (stored: string): string => READ[stored] ?? stored;

/** A name as a person writes it: "Family, Given", or a literal. */
export const nameLine = (name: WorkName): string =>
  name.literal !== undefined ? name.literal : name.given !== undefined && name.given !== "" ? `${name.family ?? ""}, ${name.given}` : (name.family ?? "");

/** Names typed one per line as "Family, Given", a single word as a family
 * name, and anything else without a comma as a literal. */
export const namesOf = (lines: string): WorkName[] =>
  lines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const comma = line.indexOf(",");
      if (comma === -1) return line.includes(" ") ? { literal: line } : { family: line };
      const family = line.slice(0, comma).trim();
      const given = line.slice(comma + 1).trim();
      return given === "" ? { family } : { family, given };
    });

/** A date as text: `2024`, `2024-03` or `2024-03-05` from its parts, else
 * its raw words. */
export const dateText = (date: WorkDate | undefined): string => {
  if (date === undefined) return "";
  const parts = date["date-parts"]?.[0];
  if (parts !== undefined && parts.length > 0) {
    const [year, month, day] = parts.map((part) => String(part));
    const pad = (value: string | undefined) => (value === undefined ? undefined : value.padStart(2, "0"));
    return [year, pad(month), pad(day)].filter((part) => part !== undefined).join("-");
  }
  return date.raw ?? "";
};

/** Text as a date: a year, a year and month, or a full date as parts, any
 * other words as raw. */
export const dateOf = (text: string): WorkDate | undefined => {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/u.exec(trimmed);
  if (match === null) return { raw: trimmed };
  const parts = [match[1], match[2], match[3]].filter((part): part is string => part !== undefined).map(Number);
  return { "date-parts": [parts] };
};

/** A record's provenance as one line of text, and back. */
const FETCHED_SEPARATOR = " · ";
export const fetchedText = (fetched: Fetched): string => [fetched.from, fetched.by, fetched.at].join(FETCHED_SEPARATOR);
export const fetchedOf = (text: string): Fetched | undefined => {
  const parts = text.split(FETCHED_SEPARATOR);
  if (parts.length !== 3) return text.trim() === "" ? undefined : { from: text.trim(), by: "", at: "" };
  return { from: parts[0] ?? "", by: parts[1] ?? "", at: parts[2] ?? "" };
};

/** *Source*'s field keys for the record's plain text fields
 * (`doc-block-roles`' `BO_0313_010`). */
const PLAIN_FIELDS: readonly (readonly [keyof WorkRecord, string])[] = [
  ["container-title", "container"],
  ["volume", "volume"],
  ["issue", "issue"],
  ["page", "pages"],
  ["publisher", "publisher"],
  ["publisher-place", "place"],
  ["DOI", "doi"],
  ["ISBN", "isbn"],
  ["URL", "url"],
  ["abstract", "abstract"],
];

const fileValueOf = (file: Readonly<Record<string, unknown>> | undefined, title: string): FileValue | undefined => {
  if (file === undefined) return undefined;
  const { hash, mediaType, size, filename } = file as { hash?: unknown; mediaType?: unknown; size?: unknown; filename?: unknown };
  if (typeof hash !== "string" || typeof size !== "number") return undefined;
  return {
    hash,
    filename: typeof filename === "string" && filename !== "" ? filename : `${title}.pdf`,
    mediaType: typeof mediaType === "string" ? mediaType : "application/pdf",
    size,
  };
};

/**
 * A record as *Source*'s field values (`BO_0313_010`): everything but the
 * title, which is the document's. A field the record does not hold is left
 * out.
 */
export function fieldsOfRecord(record: WorkRecord): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = { kind: record.kind };
  const authors = (record.author ?? []).map(nameLine).join("\n");
  const editors = (record.editor ?? []).map(nameLine).join("\n");
  if (authors !== "") values["authors"] = authors;
  if (editors !== "") values["editors"] = editors;
  const issued = dateText(record.issued);
  const accessed = dateText(record.accessed);
  if (issued !== "") values["issued"] = issued;
  if (accessed !== "") values["accessed"] = accessed;
  for (const [key, field] of PLAIN_FIELDS) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") values[field] = value;
  }
  if (record.tags !== undefined && record.tags.length > 0) values["tags"] = record.tags.join(", ");
  if (record.fetched !== undefined) values["fetched"] = fetchedText(record.fetched);
  const file = fileValueOf(record.file, record.title);
  if (file !== undefined) values["file"] = file;
  return values;
}

/**
 * The record a source document stands for: its title and *Source*'s values.
 * A kind no value names reads as `document`; the file comes back as the
 * core's blob reference with its name. Judged by `readWorkRecord`, as every
 * record is.
 */
export function recordOfSource(title: string, values: Readonly<Record<string, FieldValue | undefined>>): { readonly record: WorkRecord } | { readonly failure: string } {
  const words = (key: string): string => {
    const value = values[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const kind = words("kind");
  const out: Record<string, unknown> = { title, kind: isWorkKind(kind) ? kind : "document" };
  const authors = namesOf(words("authors"));
  const editors = namesOf(words("editors"));
  if (authors.length > 0) out["author"] = authors;
  if (editors.length > 0) out["editor"] = editors;
  const issued = dateOf(words("issued"));
  const accessed = dateOf(words("accessed"));
  if (issued !== undefined) out["issued"] = issued;
  if (accessed !== undefined) out["accessed"] = accessed;
  for (const [key, field] of PLAIN_FIELDS) if (words(field) !== "") out[key] = words(field);
  const tags = words("tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
  if (tags.length > 0) out["tags"] = tags;
  const fetched = fetchedOf(words("fetched"));
  if (fetched !== undefined) out["fetched"] = fetched;
  const file = values["file"];
  if (typeof file === "object" && file !== null)
    out["file"] = { _kind: "blob", hash: file.hash, mediaType: file.mediaType, size: file.size, filename: file.filename };
  return readWorkRecord(out);
}
