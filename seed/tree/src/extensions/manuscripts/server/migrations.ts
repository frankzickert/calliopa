
import { port } from "~/server/port";
import {
  BLOCK_STRUCTURE_TYPE,
  FIELDS_FOR,
  FIELDS_OF,
  HAS_BLOCK_STRUCTURE,
  STRUCTURE_FIELDS_TYPE,
  type FieldDeclaration,
} from "~/extensions/structures/lib/structures";
import { query, type ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

import { MANUSCRIPT_TYPE } from "../lib/rendition";

/**
 * `manuscripts`' executable migration (`calliopa-bootstrap`'s `BO_0312_023`):
 * the kernel posts `{pin, migration}` to the route when it serves a pin that
 * carries the `ext.migration` member naming it, and writes the statement
 * answered as one truth change set under the instance's owner, once per
 * instance, on the dogfood instance and on every install that takes the
 * release (`BO_0312_Q7`).
 *
 * Manuscripts are formats now. The manuscripts kept before are deleted with
 * the surface that showed them (`BO_0312_Q4`): each `manuscript` node is
 * retired, its blobs left to the store's collection. The front matter leaves
 * the document for a role the person owns (`BO_0312_Q3`): one ordinary role
 * *Paper*, with *Authors* and *Affiliations* (long text, one per line) and
 * *Keywords* (text), taken by every document that held front matter, its
 * values written in, and the document's properties cleared. An instance with
 * no front matter gets no *Paper*, and one with nothing to move answers an
 * empty statement.
 */

export interface MigrationStatement {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
}

/** The fields *Paper* is created with, keyed as `manuscripts` reads them. */
export const PAPER_FIELDS: readonly FieldDeclaration[] = [
  { key: "authors", name: "Authors", type: "longText", required: false },
  { key: "affiliations", name: "Affiliations", type: "longText", required: false },
  { key: "keywords", name: "Keywords", type: "text", required: false },
];

/** The document properties the front matter was (`BO_0293_012`). */
export const FRONT_MATTER = ["authors", "affiliations", "keywords", "venue"] as const;

/** A document's front matter as the node holds it, in *Paper*'s words. */
export interface HeldFront {
  readonly documentId: string;
  readonly values: { readonly authors: string; readonly affiliations: string; readonly keywords: string };
  /** The properties the node carries, which the migration clears. */
  readonly held: readonly string[];
}

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "") : []);

/**
 * One document's front matter in *Paper*'s words: an author per line, its
 * address in angle brackets and the corresponding author marked with `*` as
 * the manuscript printed it; an affiliation per line; the keywords separated
 * by commas. Which affiliation was whose is kept where *Paper* can say it —
 * one shared, or one each in order — and otherwise every affiliation stays
 * listed. The venue was a template's id and has no field on *Paper*: a
 * person's venue role says it now.
 */
export function heldFront(node: ReadNode): HeldFront | null {
  const content = node.revision.content ?? {};
  const held = FRONT_MATTER.filter((key) => content[key] !== undefined && content[key] !== null);
  if (held.length === 0) return null;
  const authors = (Array.isArray(content["authors"]) ? content["authors"] : []).flatMap((entry) => {
    const author = record(entry);
    const name = typeof author["name"] === "string" ? author["name"].trim() : "";
    if (name === "") return [];
    const email = typeof author["email"] === "string" && author["email"].trim() !== "" ? ` <${author["email"].trim()}>` : "";
    return [`${name}${author["corresponding"] === true ? "*" : ""}${email}`];
  });
  return {
    documentId: bareId(node.id),
    values: { authors: authors.join("\n"), affiliations: strings(content["affiliations"]).join("\n"), keywords: strings(content["keywords"]).join(", ") },
    held,
  };
}

/** The script: retire the kept manuscripts, create *Paper* when a document
 * holds front matter, and move each one's values onto it. `mint` names the
 * new ids, so the statement is pure. */
export function formatsStatement(
  manuscripts: readonly string[],
  fronts: readonly HeldFront[],
  paperOrder: number,
  mint: () => string = () => port.uuid(),
): MigrationStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  manuscripts.forEach((id, index) => {
    parameters[`m${index}NodeId`] = nodeRef(id);
    statements.push(`RETIRE m${index}`);
  });
  if (fronts.length > 0) {
    const paper = mint();
    parameters["p_id"] = paper;
    parameters["p_name"] = "Paper";
    parameters["p_description"] = "A paper's front matter: its authors, their affiliations and its keywords.";
    parameters["p_order"] = paperOrder;
    parameters["p_fields"] = PAPER_FIELDS;
    parameters["pref"] = nodeRef(paper);
    statements.push(
      `CREATE (p:${BLOCK_STRUCTURE_TYPE} {id: $p_id, name: $p_name, description: $p_description, order: $p_order, fields: $p_fields, status: "established"})`,
    );
    // Sets precede relates: a relation anchors at the document's revision,
    // and a SET after it would stage a second one. BO_0118_001
    fronts.forEach((front, index) => {
      parameters[`d${index}NodeId`] = nodeRef(front.documentId);
      statements.push(`SET ${front.held.map((key) => `d${index}.${key} = null`).join(", ")}`);
    });
    fronts.forEach((front, index) => {
      const values = mint();
      parameters[`v${index}_id`] = values;
      parameters[`v${index}_role`] = paper;
      parameters[`v${index}_values`] = front.values;
      parameters[`v${index}ref`] = nodeRef(values);
      parameters[`d${index}ref`] = nodeRef(front.documentId);
      statements.push(
        `RELATE d${index}ref -[h${index}:${HAS_BLOCK_STRUCTURE}]-> pref`,
        `CREATE (v${index}:${STRUCTURE_FIELDS_TYPE} {id: $v${index}_id, role: $v${index}_role, values: $v${index}_values, status: "established"})`,
        `RELATE v${index}ref -[o${index}:${FIELDS_OF}]-> d${index}ref`,
        `RELATE v${index}ref -[f${index}:${FIELDS_FOR}]-> pref`,
      );
    });
  }
  return { statement: statements.join("; "), parameters };
}

const established = (node: ReadNode, type: string): boolean => node.revision.status === "established" && (node.revision.content ?? {})["_type"] === type;

/** What the migration finds: the kept manuscripts, the documents holding
 * front matter, and the place after the roles already there. */
export async function readFormats(): Promise<
  GraphOutcome<{ readonly manuscripts: readonly string[]; readonly fronts: readonly HeldFront[]; readonly paperOrder: number }>
> {
  const kept = await query({ statement: `MATCH (m:${MANUSCRIPT_TYPE}) RETURN GRAPH m`, unbounded: true, metadataOnly: true, purpose: "migration: kept manuscripts" });
  if (kept.outcome !== "success" && kept.outcome !== "noResult") return kept as GraphOutcome<never>;
  const manuscripts = (kept.outcome === "success" ? kept.result.nodes : [])
    .filter((node) => node.revision.status === "established")
    .map((node) => bareId(node.id))
    .sort();
  const documents = await query({ statement: "MATCH (d:document) RETURN GRAPH d", unbounded: true, purpose: "migration: front matter" });
  if (documents.outcome !== "success" && documents.outcome !== "noResult") return documents as GraphOutcome<never>;
  const fronts = (documents.outcome === "success" ? documents.result.nodes : [])
    .filter((node) => established(node, "document"))
    .map(heldFront)
    .filter((front): front is HeldFront => front !== null)
    .sort((left, right) => (left.documentId < right.documentId ? -1 : 1));
  const roles = await query({ statement: `MATCH (r:${BLOCK_STRUCTURE_TYPE}) RETURN GRAPH r`, unbounded: true, purpose: "migration: the roles' order" });
  if (roles.outcome !== "success" && roles.outcome !== "noResult") return roles as GraphOutcome<never>;
  const highest = (roles.outcome === "success" ? roles.result.nodes : []).reduce((top, node) => {
    const order = (node.revision.content ?? {})["order"];
    return typeof order === "number" && Number.isFinite(order) ? Math.max(top, order) : top;
  }, 0);
  return { outcome: "success", result: { manuscripts, fronts, paperOrder: highest + 1 } };
}

/** The migrations this extension runs, by the route segment its member names. */
export const MIGRATIONS: Readonly<Record<string, () => Promise<GraphOutcome<MigrationStatement>>>> = {
  /** Manuscripts are formats: the kept ones go, front matter moves to Paper. BO_0312_023 */
  formats: async () => {
    const found = await readFormats();
    if (found.outcome !== "success") return found as GraphOutcome<never>;
    return { outcome: "success", result: formatsStatement(found.result.manuscripts, found.result.fronts, found.result.paperOrder) };
  },
};
