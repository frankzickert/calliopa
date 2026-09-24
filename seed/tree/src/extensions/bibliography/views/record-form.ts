import { WORK_KINDS, isWorkKind, type WorkKind, type WorkName, type WorkRecord } from "../lib/work";

/**
 * The work view's form and the record it stands for (`BO_0291_019`): one
 * pure mapping each way, so what a person types is judged by the same
 * `readWorkRecord` the route applies, and a record read back fills the same
 * fields it was edited in. Names are typed one per line as "Family, Given"
 * or a single literal; a year alone is `issued` with one date part.
 */

export interface RecordForm {
  readonly title: string;
  readonly kind: WorkKind;
  readonly authors: string;
  readonly editors: string;
  readonly year: string;
  readonly containerTitle: string;
  readonly volume: string;
  readonly issue: string;
  readonly page: string;
  readonly publisher: string;
  readonly publisherPlace: string;
  readonly doi: string;
  readonly isbn: string;
  readonly url: string;
  readonly abstract: string;
  readonly tags: string;
}

export const EMPTY_FORM: RecordForm = {
  title: "",
  kind: "article-journal",
  authors: "",
  editors: "",
  year: "",
  containerTitle: "",
  volume: "",
  issue: "",
  page: "",
  publisher: "",
  publisherPlace: "",
  doi: "",
  isbn: "",
  url: "",
  abstract: "",
  tags: "",
};

/** A name as a person writes it: "Family, Given", or a literal. */
export const nameLine = (name: WorkName): string =>
  name.literal !== undefined ? name.literal : name.given !== undefined && name.given !== "" ? `${name.family ?? ""}, ${name.given}` : (name.family ?? "");

/** The year a date carries, or "". */
export const yearOf = (date: WorkRecord["issued"]): string => {
  const first = date?.["date-parts"]?.[0]?.[0];
  if (first !== undefined) return String(first);
  const raw = date?.raw ?? "";
  const match = /\d{4}/u.exec(raw);
  return match === null ? "" : match[0];
};

export function formOf(record: WorkRecord): RecordForm {
  return {
    title: record.title,
    kind: record.kind,
    authors: (record.author ?? []).map(nameLine).join("\n"),
    editors: (record.editor ?? []).map(nameLine).join("\n"),
    year: yearOf(record.issued),
    containerTitle: record["container-title"] ?? "",
    volume: record.volume ?? "",
    issue: record.issue ?? "",
    page: record.page ?? "",
    publisher: record.publisher ?? "",
    publisherPlace: record["publisher-place"] ?? "",
    doi: record.DOI ?? "",
    isbn: record.ISBN ?? "",
    url: record.URL ?? "",
    abstract: record.abstract ?? "",
    tags: (record.tags ?? []).join(", "),
  };
}

const namesOf = (lines: string): WorkName[] =>
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

const words = (value: string): string | undefined => (value.trim() === "" ? undefined : value.trim());

/**
 * The record a form stands for, with what the form does not edit — the
 * fetched mark, the file, the accessed date — carried over from the record
 * it was filled from.
 */
export function recordOf(form: RecordForm, kept?: Pick<WorkRecord, "fetched" | "file" | "accessed">): Record<string, unknown> {
  const year = form.year.trim();
  const out: Record<string, unknown> = {
    title: form.title.trim(),
    kind: isWorkKind(form.kind) ? form.kind : WORK_KINDS[0],
  };
  const authors = namesOf(form.authors);
  const editors = namesOf(form.editors);
  if (authors.length > 0) out["author"] = authors;
  if (editors.length > 0) out["editor"] = editors;
  if (/^\d{4}$/u.test(year)) out["issued"] = { "date-parts": [[Number(year)]] };
  else if (year !== "") out["issued"] = { raw: year };
  const plain: readonly (readonly [keyof RecordForm, string])[] = [
    ["containerTitle", "container-title"],
    ["volume", "volume"],
    ["issue", "issue"],
    ["page", "page"],
    ["publisher", "publisher"],
    ["publisherPlace", "publisher-place"],
    ["doi", "DOI"],
    ["isbn", "ISBN"],
    ["url", "URL"],
    ["abstract", "abstract"],
  ];
  for (const [field, key] of plain) {
    const value = words(form[field]);
    if (value !== undefined) out[key] = value;
  }
  const tags = form.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
  if (tags.length > 0) out["tags"] = tags;
  if (kept?.fetched !== undefined) out["fetched"] = kept.fetched;
  if (kept?.file !== undefined) out["file"] = kept.file;
  if (kept?.accessed !== undefined) out["accessed"] = kept.accessed;
  return out;
}

/** What a row of the Sources section says: authors, year and title. */
export function lineOf(record: WorkRecord): { readonly who: string; readonly year: string; readonly title: string } {
  const names = (record.author ?? record.editor ?? []).map((name) => name.literal ?? name.family ?? "").filter((name) => name !== "");
  const who = names.length === 0 ? "" : names.length === 1 ? (names[0] as string) : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} et al.`;
  return { who, year: yearOf(record.issued), title: record.title };
}

/** Whether a work matches what a person typed into the section's search. */
export function matches(record: WorkRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  const hay = [
    record.title,
    ...(record.author ?? []).map(nameLine),
    ...(record.editor ?? []).map(nameLine),
    yearOf(record.issued),
    record["container-title"] ?? "",
    ...(record.tags ?? []),
    record.DOI ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/u).every((word) => hay.includes(word));
}
