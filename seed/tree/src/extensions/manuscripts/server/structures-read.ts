import { FORMAT_STRUCTURE, mintFieldKey, type TakenStructure } from "~/extensions/structures/lib/structures";
import { structuresOf } from "~/extensions/structures/server/structures";

import { frontOf, NO_FRONT, type Front } from "../lib/front";

/**
 * What a manuscript reads from the roles (`calliopa-bootstrap`'s
 * `BO_0312_020`): that the document carries *Format* as a PDF, the venue's
 * `template` and `citationStyle` from the venue role the run names, and the
 * front matter's `authors`, `affiliations` and `keywords` from the paper role
 * it names — all on the document, since *Format* is taken by documents alone
 * (`BO_0332_030`). *Venue* and *Paper* are the
 * person's roles, so nothing looks a role up by name: the run names them, and
 * the values are read by field key (technical decision at transfer,
 * 2026-09-30). A field made before keys were minted from names is found by
 * the key its name would mint.
 */

/** A role the run named that the document does not carry, or a document
 * that is not one to make a manuscript of: said to the run in words. */
export class MakingRefusal extends Error {}

export interface Making {
  /** The venue template, or `generic` when no venue role says one. */
  readonly venue: string;
  readonly citationStyle?: string;
  readonly front: Front;
  /** The field keys read, and the ones looked for and not found. */
  readonly read: readonly string[];
  readonly missing: readonly string[];
}

const valueOf = (role: TakenStructure, key: string): string | undefined => {
  const direct = role.values[key];
  if (typeof direct === "string" && direct.trim() !== "") return direct.trim();
  const named = role.fields.find((field) => field.key !== key && mintFieldKey(field.name, []) === key);
  const fallback = named === undefined ? undefined : role.values[named.key];
  return typeof fallback === "string" && fallback.trim() !== "" ? fallback.trim() : undefined;
};

export async function readMaking(input: {
  readonly documentId: string;
  readonly venueStructure?: string;
  readonly paperStructure?: string;
  readonly dataRevision?: number;
}): Promise<Making> {
  const read = await structuresOf(input.documentId, input.dataRevision === undefined ? {} : { dataRevision: input.dataRevision });
  if (read.outcome !== "success") throw new MakingRefusal(`the structures of document ${input.documentId} could not be read: ${read.outcome}`);
  const subject = read.result.structures;
  const format = subject.find((role) => role.id === FORMAT_STRUCTURE);
  if (format === undefined)
    throw new MakingRefusal(
      "the document uses no Format structure: a manuscript is made of a whole document using Format (PDF) and kept on it, so propose Format on the document first; a part formatted on its own is a block's focused work, whose document uses Format",
    );
  const type = valueOf(format, "type");
  if (type !== undefined && type.toLowerCase() !== "pdf") throw new MakingRefusal(`the document carries Format as ${type}, not PDF: a manuscript is a PDF`);

  const found: string[] = [];
  const missing: string[] = type === undefined ? ["type"] : [];
  if (type !== undefined) found.push("type");
  const taken = (id: string | undefined, what: string): TakenStructure | undefined => {
    if (id === undefined) return undefined;
    const role = subject.find((candidate) => candidate.id === id);
    if (role === undefined) throw new MakingRefusal(`the ${what} structure ${id} is not used on the document: read the document's structures and name one it uses`);
    return role;
  };
  const pick = (role: TakenStructure | undefined, keys: readonly string[]): Record<string, string> => {
    const values: Record<string, string> = {};
    if (role === undefined) return values;
    for (const key of keys) {
      const value = valueOf(role, key);
      if (value === undefined) missing.push(key);
      else {
        values[key] = value;
        found.push(key);
      }
    }
    return values;
  };
  const venue = pick(taken(input.venueStructure, "venue"), ["template", "citationStyle"]);
  const paper = pick(taken(input.paperStructure, "paper"), ["authors", "affiliations", "keywords"]);
  return {
    venue: venue["template"] ?? "generic",
    ...(venue["citationStyle"] === undefined ? {} : { citationStyle: venue["citationStyle"] }),
    front: input.paperStructure === undefined ? NO_FRONT : frontOf(paper),
    read: found,
    missing,
  };
}
