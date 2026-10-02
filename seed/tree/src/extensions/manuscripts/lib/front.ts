/**
 * The front matter a manuscript's head carries (`calliopa-bootstrap`'s
 * `BO_0312_Q3`), read from the role the run names — the person's *Paper*
 * after the migration — rather than from the document: authors and
 * affiliations one per line, keywords separated by commas. Pure, so every
 * rule is a case of the test beside it.
 */
export interface Author {
  readonly name: string;
  readonly email?: string;
  readonly affiliation?: string;
}

export interface Front {
  readonly authors: readonly Author[];
  readonly keywords: readonly string[];
}

export const NO_FRONT: Front = { authors: [], keywords: [] };

const lines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/**
 * Authors and affiliations from their one-per-line fields. An author line may
 * end with an address in angle brackets, `Ada Lovelace <ada@example.org>`.
 * Which affiliation is whose: one affiliation is every author's; as many as
 * there are authors pair by position; otherwise each author carries them all,
 * so nothing written is dropped. Keywords are split at commas and semicolons.
 */
export function frontOf(values: { readonly authors?: string; readonly affiliations?: string; readonly keywords?: string }): Front {
  const affiliations = lines(values.affiliations ?? "");
  const named = lines(values.authors ?? "");
  const authors = named.map((line, at): Author => {
    const address = /^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/u.exec(line);
    const name = address === null ? line : (address[1] ?? "").trim();
    const affiliation =
      affiliations.length === 0
        ? undefined
        : affiliations.length === 1
          ? affiliations[0]
          : affiliations.length === named.length
            ? affiliations[at]
            : affiliations.join("; ");
    return {
      name,
      ...(address === null ? {} : { email: address[2] as string }),
      ...(affiliation === undefined ? {} : { affiliation }),
    };
  });
  const keywords = (values.keywords ?? "")
    .split(/[,;\n]/u)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== "");
  return { authors, keywords };
}
