/**
 * A document's front matter (`BO_0293_012`): what a manuscript's head projects,
 * stored on the `document` node — the authors, each a name with the indexes of
 * their affiliations, an optional email and whether they are the corresponding
 * one; the affiliations; the keywords; and the venue the manuscript is made
 * for. The abstract is not here: it is a text block of the role `abstract`.
 *
 * One reader, used by the validator, the command parser and the document read,
 * so a value is judged one way everywhere.
 */
export interface Author {
  readonly name: string;
  readonly affiliations?: readonly number[];
  readonly email?: string;
  readonly corresponding?: true;
}

export interface FrontMatter {
  readonly authors?: readonly Author[];
  readonly affiliations?: readonly string[];
  readonly keywords?: readonly string[];
  readonly venue?: string;
}

const VENUE = /^[a-z][a-z0-9-]{0,39}$/;

const words = (value: unknown, what: string): { readonly list: string[] } | { readonly failure: string } => {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    return { failure: `A document's ${what} are words, one per entry.` };
  }
  return { list: (value as string[]).map((entry) => entry.trim()).filter((entry) => entry !== "") };
};

/** Reads the four properties from untrusted content, or says why they are not
 * front matter. What is absent stays absent; an empty list is absent. */
export function readFrontMatter(content: Record<string, unknown>): { readonly frontMatter: FrontMatter } | { readonly failure: string } {
  const out: { authors?: Author[]; affiliations?: string[]; keywords?: string[]; venue?: string } = {};
  if (content["affiliations"] !== undefined) {
    const read = words(content["affiliations"], "affiliations");
    if ("failure" in read) return read;
    if (read.list.length > 0) out.affiliations = read.list;
  }
  if (content["keywords"] !== undefined) {
    const read = words(content["keywords"], "keywords");
    if ("failure" in read) return read;
    if (read.list.length > 0) out.keywords = read.list;
  }
  const venue = content["venue"];
  if (venue !== undefined && venue !== null) {
    if (typeof venue !== "string" || !VENUE.test(venue)) return { failure: "A document's venue is a venue's name, a word." };
    out.venue = venue;
  }
  const authors = content["authors"];
  if (authors !== undefined) {
    if (!Array.isArray(authors)) return { failure: "A document's authors are a list." };
    const affiliationCount = out.affiliations?.length ?? 0;
    const read: Author[] = [];
    for (const [index, raw] of authors.entries()) {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { failure: `Author ${index + 1} is not an author.` };
      const { name, affiliations, email, corresponding, ...rest } = raw as Record<string, unknown>;
      const foreign = Object.keys(rest)[0];
      if (foreign !== undefined) return { failure: `Author ${index + 1} carries ${foreign}, which an author does not carry.` };
      if (typeof name !== "string" || name.trim() === "") return { failure: `Author ${index + 1} carries no name.` };
      if (affiliations !== undefined) {
        if (!Array.isArray(affiliations) || !affiliations.every((at) => Number.isInteger(at) && (at as number) >= 0 && (at as number) < affiliationCount)) {
          return { failure: `Author ${index + 1}'s affiliations name the document's affiliations by their place in its list.` };
        }
      }
      if (email !== undefined && typeof email !== "string") return { failure: `Author ${index + 1}'s email is an address.` };
      if (corresponding !== undefined && corresponding !== true) return { failure: `Author ${index + 1} is corresponding or not; corresponding is true when they are.` };
      read.push({
        name: name.trim(),
        ...(Array.isArray(affiliations) && affiliations.length > 0 ? { affiliations: affiliations as number[] } : {}),
        ...(typeof email === "string" && email.trim() !== "" ? { email: email.trim() } : {}),
        ...(corresponding === true ? { corresponding: true as const } : {}),
      });
    }
    if (read.length > 0) out.authors = read;
  }
  return { frontMatter: out };
}
