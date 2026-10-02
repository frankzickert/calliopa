import type { FieldDeclaration, FieldValue, TakenRole } from "./roles";

/**
 * The values line in a document's header (`documents`' `DO_0030`,
 * `DO_0030_005`): per own role holding a filled value, the role's name and
 * its filled values in field order, each as a person reads it. Empty fields
 * are left out, and so is a role with none filled; a missing required value
 * stays the pill's `!`. Pure, so the words are proven without a page.
 */
export interface ValuesEntry {
  readonly role: string;
  readonly name: string;
  readonly values: readonly string[];
}

/** Longest a long text runs in the line. */
const LONG_TEXT = 80;

const cut = (words: string, length: number): string =>
  words.length > length ? `${words.slice(0, length - 1).trimEnd()}…` : words;

/** A stored date (`YYYY-MM-DD`) in the reader's locale, as it was written:
 * read as a calendar day, so no time zone moves it. */
function dateWords(value: string, locale: string | undefined): string {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (found === null) return value;
  const day = new Date(Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3])));
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(day);
}

/** One value as a person reads it, or nothing when it says nothing. */
export function valueWords(
  field: FieldDeclaration,
  value: FieldValue | undefined,
  titles: Readonly<Record<string, string>>,
  locale?: string,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  switch (field.type) {
    case "boolean":
      return value === true ? field.name : null;
    case "number":
      return typeof value === "number" ? String(value) : null;
    case "date":
      return typeof value === "string" ? dateWords(value, locale) : null;
    case "longText": {
      if (typeof value !== "string") return null;
      const first = value.split(/\r?\n/u).find((line) => line.trim() !== "")?.trim() ?? "";
      return first === "" ? null : cut(first, LONG_TEXT);
    }
    case "file":
      return typeof value === "object" ? value.filename : null;
    case "reference":
      // A reference by what it names; one naming nothing that reads is
      // shown as the id it holds rather than hidden.
      return typeof value === "string" ? (titles[value] ?? value) : null;
    default: {
      if (typeof value !== "string") return null;
      const words = value.trim();
      return words === "" ? null : words;
    }
  }
}

/** The line's entries, in the order the roles stand. */
export function valuesLine(
  roles: readonly TakenRole[],
  titles: Readonly<Record<string, string>> = {},
  locale?: string,
): ValuesEntry[] {
  const entries: ValuesEntry[] = [];
  for (const role of roles) {
    if (role.proposed === "role") continue;
    const values = role.fields
      .map((field) => valueWords(field, role.values[field.key], titles, locale))
      .filter((words): words is string => words !== null);
    if (values.length > 0) entries.push({ role: role.id, name: role.name, values });
  }
  return entries;
}
