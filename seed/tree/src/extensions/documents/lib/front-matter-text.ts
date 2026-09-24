import type { Author, FrontMatter } from "./front-matter";

/**
 * The front matter as the document's panel writes it (`BO_0293_016`): one line
 * of text for each part, since the panel's controls are lines — the shell's
 * `field` — and a form of its own would widen the shell's contract for one
 * view.
 *
 * - Authors, separated by `;`, each `Name (1, 2) <email> *`: the numbers are
 *   the author's affiliations by their place in the affiliations line, from
 *   one; the address in angle brackets is optional; a trailing `*` marks the
 *   corresponding author.
 * - Affiliations, separated by `;`, in the order the numbers name them.
 * - Keywords, separated by `,`.
 *
 * `authorsText` and `readAuthors` are inverse, so what the panel shows is what
 * saving it again writes.
 */
export function authorsText(authors: readonly Author[] | undefined): string {
  return (authors ?? [])
    .map((author) =>
      [
        author.name,
        author.affiliations !== undefined && author.affiliations.length > 0 ? `(${author.affiliations.map((at) => at + 1).join(", ")})` : "",
        author.email !== undefined ? `<${author.email}>` : "",
        author.corresponding === true ? "*" : "",
      ]
        .filter((part) => part !== "")
        .join(" "),
    )
    .join("; ");
}

const AUTHOR = /^(?<name>[^(<*]+?)\s*(?:\((?<places>[^)]*)\))?\s*(?:<(?<email>[^>]*)>)?\s*(?<star>\*)?$/;

/** Reads the authors line, or says which author it cannot read. */
export function readAuthors(text: string, affiliationCount: number): { readonly authors: Author[] } | { readonly failure: string } {
  const authors: Author[] = [];
  for (const [index, raw] of text.split(";").map((part) => part.trim()).filter((part) => part !== "").entries()) {
    const match = AUTHOR.exec(raw);
    const name = match?.groups?.["name"]?.trim() ?? "";
    if (match === null || name === "") return { failure: `Author ${index + 1} reads as “${raw}”, which is not Name (1, 2) <email> *.` };
    const places = (match.groups?.["places"] ?? "")
      .split(",")
      .map((place) => place.trim())
      .filter((place) => place !== "");
    const affiliations: number[] = [];
    for (const place of places) {
      const at = Number(place);
      if (!Number.isInteger(at) || at < 1 || at > affiliationCount) {
        return { failure: `${name} names affiliation ${place}, and the document lists ${affiliationCount === 0 ? "none" : `1 to ${affiliationCount}`}.` };
      }
      affiliations.push(at - 1);
    }
    const email = match.groups?.["email"]?.trim();
    authors.push({
      name,
      ...(affiliations.length > 0 ? { affiliations } : {}),
      ...(email !== undefined && email !== "" ? { email } : {}),
      ...(match.groups?.["star"] === "*" ? { corresponding: true as const } : {}),
    });
  }
  return { authors };
}

/** A list the panel writes as one line, split and trimmed. */
export const listOf = (text: string, separator: ";" | ","): string[] =>
  text
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part !== "");

/** The front matter with one part replaced, leaving the others as they are. */
export const withPart = (current: FrontMatter, part: Partial<FrontMatter>): FrontMatter => {
  const next: Record<string, unknown> = { ...current, ...part };
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (value === undefined || (Array.isArray(value) && value.length === 0) || value === "") delete next[key];
  }
  return next as FrontMatter;
};
