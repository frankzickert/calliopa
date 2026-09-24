/**
 * The bibliography's vocabulary (`BO_0291_015`, `BO_0291_016`): a `work` is
 * a bibliographic work — the cited thing — a root node of this extension whose
 * record is CSL-JSON, the shape a DOI resolves to, the engine exports and the
 * citation processor consumes. The identifier is the identity for duplicates.
 * Shared by the server and, later, the surfaces, so a record is judged one
 * way everywhere.
 */

export const WORK_TYPE = "work";

/** The CSL types the fetch can answer, as the declaration permits them. */
export const WORK_KINDS = [
  "article-journal",
  "book",
  "chapter",
  "paper-conference",
  "thesis",
  "report",
  "webpage",
  "post",
  "dataset",
  "software",
  "document",
] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export const isWorkKind = (value: unknown): value is WorkKind => WORK_KINDS.includes(value as WorkKind);

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
  if (!Array.isArray(value)) return { failure: `A work's ${field} is a list of names.` };
  const names: WorkName[] = [];
  for (const entry of value) {
    const name = record(entry);
    if (name === null) return { failure: `A work's ${field} is a list of names.` };
    const family = name["family"];
    const given = name["given"];
    const literal = name["literal"];
    if ((family !== undefined && !text(family)) || (given !== undefined && !text(given)) || (literal !== undefined && !text(literal))) {
      return { failure: `A name in a work's ${field} carries family, given or literal, as words.` };
    }
    if (family === undefined && literal === undefined) {
      return { failure: `A name in a work's ${field} carries a family name or a literal.` };
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
  if (date === null) return { failure: `A work's ${field} is a date: date-parts or raw.` };
  const parts = date["date-parts"];
  const raw = date["raw"];
  if (parts === undefined && raw === undefined) return { failure: `A work's ${field} is a date: date-parts or raw.` };
  if (raw !== undefined && !text(raw)) return { failure: `A work's ${field} raw date is words.` };
  if (parts !== undefined) {
    if (!Array.isArray(parts) || !parts.every((part) => Array.isArray(part) && part.length >= 1 && part.length <= 3 && part.every((p: unknown) => typeof p === "number" || text(p)))) {
      return { failure: `A work's ${field} date-parts are [[year, month, day]].` };
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
  if (content === null) return { failure: "A work carries a record." };
  const title = content["title"];
  if (!text(title) || title.trim() === "") return { failure: "A work carries a title." };
  const kind = content["kind"];
  if (!isWorkKind(kind)) return { failure: `A work's kind is one of ${WORK_KINDS.join(", ")}.` };
  const out: Record<string, unknown> = { title, kind };
  for (const key of Object.keys(content)) {
    if (key === "title" || key === "kind") continue;
    if (!(WORK_FIELDS as readonly string[]).includes(key)) return { failure: `A work carries no ${key}.` };
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
      if (!Array.isArray(field) || !field.every(text)) return { failure: "A work's tags are words." };
      out[key] = field;
    } else if (key === "fetched") {
      const fetched = record(field);
      if (fetched === null || !text(fetched["by"]) || !text(fetched["at"]) || !text(fetched["from"])) {
        return { failure: "A work's fetched says by whom, when and from which identifier." };
      }
      out[key] = { by: fetched["by"], at: fetched["at"], from: fetched["from"] };
    } else if (key === "file") {
      const file = record(field);
      if (file === null) return { failure: "A work's file is the core's blob reference." };
      out[key] = file;
    } else {
      if (!text(field)) return { failure: `A work's ${key} is words.` };
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
 * A CSL-JSON item as the engine exports it, read as a work's record: CSL's
 * `type` becomes `kind`, its `id` (the engine's key) is dropped, the fields
 * the declaration permits are kept and everything else is left behind. A
 * type outside the permitted set reads as `document`.
 */
export function recordFromCsl(item: Record<string, unknown>, fetched: Fetched): { readonly record: WorkRecord } | { readonly failure: string } {
  const type = item["type"];
  const kind: WorkKind = isWorkKind(type) ? type : type === "post-weblog" ? "post" : type === "article" || type === "manuscript" ? "document" : "document";
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
 * The graph's name for a record field (found 2026-09-23): the Cypher dialect
 * has no quoted identifiers, so CSL's two hyphenated keys cannot be written
 * as property names and are stored in camel case; every other key is stored
 * as it is. The record keeps CSL's own keys everywhere else, so the mapping
 * lives at the write and the read and nowhere between.
 */
const STORED: Readonly<Record<string, string>> = { "container-title": "containerTitle", "publisher-place": "publisherPlace" };
const READ: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(STORED).map(([csl, stored]) => [stored, csl]));

export const storedKey = (key: string): string => STORED[key] ?? key;
export const recordKey = (stored: string): string => READ[stored] ?? stored;
