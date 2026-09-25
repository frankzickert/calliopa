import type { Author, FrontMatter } from "./front-matter";

/**
 * The head's edits (`BO_0293_025`, user decision 2026-09-25): what each gesture
 * on the front matter's fields writes. The affiliations and the keywords are
 * chips — a word entered joins the list, a chip removed leaves it — and the
 * authors are rows of a name, an email, the affiliations they belong to and
 * whether they are the corresponding author. Pure: a front matter and a
 * gesture in, the front matter to write out, so every rule is a case of the
 * test beside it.
 */

/** One author as a row of the head holds it while edited: every field
 * present, so a control has something to bind. */
export interface AuthorRow {
  readonly name: string;
  readonly email: string;
  readonly affiliations: readonly number[];
  readonly corresponding: boolean;
}

/** The front matter with one part replaced, leaving the others as they are;
 * a part emptied is absent. */
export const withPart = (current: FrontMatter, part: Partial<FrontMatter>): FrontMatter => {
  const next: Record<string, unknown> = { ...current, ...part };
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (value === undefined || (Array.isArray(value) && value.length === 0) || value === "") delete next[key];
  }
  return next as FrontMatter;
};

/** The list with a word entered, or null when the word is empty or already
 * listed, so nothing is written for it. */
export function addWord(list: readonly string[] | undefined, word: string): string[] | null {
  const trimmed = word.trim();
  if (trimmed === "") return null;
  const current = list ?? [];
  if (current.includes(trimmed)) return null;
  return [...current, trimmed];
}

/** The front matter without the keyword at `at`. */
export function removeKeyword(front: FrontMatter, at: number): FrontMatter {
  return withPart(front, { keywords: (front.keywords ?? []).filter((_, index) => index !== at) });
}

/** The front matter without the affiliation at `at`, every author's
 * affiliations renumbered so none names a place the document no longer
 * lists: the removed one is dropped, the ones after it move up. */
export function removeAffiliation(front: FrontMatter, at: number): FrontMatter {
  const affiliations = (front.affiliations ?? []).filter((_, index) => index !== at);
  const authors = (front.authors ?? []).map((author) => {
    const kept = (author.affiliations ?? []).filter((place) => place !== at).map((place) => (place > at ? place - 1 : place));
    const { affiliations: _dropped, ...rest } = author;
    return kept.length > 0 ? { ...rest, affiliations: kept } : rest;
  });
  return withPart(front, { affiliations, authors });
}

/** The authors as rows, every field present. */
export const rowsOf = (authors: readonly Author[] | undefined): AuthorRow[] =>
  (authors ?? []).map((author) => ({
    name: author.name,
    email: author.email ?? "",
    affiliations: [...(author.affiliations ?? [])],
    corresponding: author.corresponding === true,
  }));

/** A row nothing has been typed into yet: not an author, and no failure. */
export const isBlank = (row: AuthorRow): boolean => row.name.trim() === "" && row.email.trim() === "" && row.affiliations.length === 0 && !row.corresponding;

/** The rows as the authors to write. A blank row is left out; a row with an
 * email or an affiliation but no name is refused, since an author is a name
 * before anything else. */
export function authorsOf(rows: readonly AuthorRow[]): { readonly authors: Author[] } | { readonly failure: string } {
  const authors: Author[] = [];
  for (const [index, row] of rows.entries()) {
    if (isBlank(row)) continue;
    const name = row.name.trim();
    if (name === "") return { failure: `Author ${index + 1} has no name yet.` };
    const affiliations = [...row.affiliations].sort((left, right) => left - right);
    const email = row.email.trim();
    authors.push({
      name,
      ...(affiliations.length > 0 ? { affiliations } : {}),
      ...(email !== "" ? { email } : {}),
      ...(row.corresponding ? { corresponding: true as const } : {}),
    });
  }
  return { authors };
}
