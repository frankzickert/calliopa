import type { LibraryFacet, LibraryFilter, LibraryGlyph, LibraryItem } from "~/contract";
import type { DocumentSummary } from "~/lib/library";
import type { StartedBy } from "../server/assemble";
import { proposerName } from "./proposals";
import { isUnnamed } from "./naming";

/** A document as the listing answers it, with the run that started it when
 * nobody has taken it yet (`listDocuments`). BO_0251_011 */
export interface ListedDocumentEntry extends DocumentSummary {
  readonly proposed?: StartedBy;
  /** The document's `record`, absent for a plain document. DO_0038_003 */
  readonly record?: string;
  /** When the document or one of its blocks last changed, and when the
   * document was created, in milliseconds; absent when the read could not
   * say. DO_0038_003 */
  readonly changedAt?: number;
  readonly createdAt?: number;
  /** What an extension names the document — `structure` for a document
   * using *Structure* — absent when none does (`namesOfDocuments`).
   * DO_0042_002 */
  readonly named?: string;
}

/**
 * A document's row in the library. A started document says who proposed it
 * — the runtime, for the face, and the words the proposal face uses — so the
 * frame draws the row as a proposal (`layout.md` `BO_0251_012`). BO_0251_011
 *
 * A document still carrying the name it was minted with says so too, and the
 * frame draws the label muted wherever it names it. The label stays those
 * words: what is listed is still named in the listing, and the frame is told
 * rather than left to recognise words it does not own. DO_0012_003
 */
export function documentItem(entry: ListedDocumentEntry, glyph: LibraryGlyph | undefined): LibraryItem {
  const proposer = entry.proposed?.proposer;
  return {
    id: entry.documentId,
    label: entry.title,
    ...(glyph === undefined ? {} : { glyph }),
    ...(proposer === undefined
      ? {}
      : { proposedBy: { agent: proposer.kind === "person" ? null : proposer.agent, name: proposerName(proposer) } }),
    ...(isUnnamed(entry.title) ? { unnamed: true } : {}),
    facets: documentFacets(entry),
    ...(entry.changedAt === undefined || entry.createdAt === undefined
      ? {}
      : { orderKeys: { changed: entry.changedAt, created: entry.createdAt } }),
    open: { kind: "document", itemId: entry.documentId, title: entry.title },
  };
}

/** A plain document's kind, which the filter names as every recorded one. */
const PLAIN = "document";

/** The word `structures` names a document defining a structure by, and the
 * filter's group and value for it. DO_0042_003 */
const STRUCTURE = "structure";

/** What a document carries for the Documents section's filter: its kind, and
 * whether a run started it or it still carries its minted name. DO_0038_004
 * And whether it defines a structure. DO_0042_003 */
function documentFacets(entry: ListedDocumentEntry): Readonly<Record<string, LibraryFacet>> {
  const kind = entry.record ?? PLAIN;
  return {
    kind: { value: kind, label: kind.charAt(0).toUpperCase() + kind.slice(1) },
    ...(entry.proposed === undefined ? {} : { started: { value: "started", label: "Started by an agent", icon: "robot" } }),
    ...(isUnnamed(entry.title) ? { unnamed: { value: "unnamed", label: "Unnamed" } } : {}),
    ...(entry.named === STRUCTURE ? { [STRUCTURE]: { value: STRUCTURE, label: "Structures" } } : {}),
  };
}

/**
 * The Documents section's filter (`DO_0038`): the title search, the kind, the
 * documents a run started that nobody has taken and the unnamed ones, and the
 * four orders, by title by default. DO_0038_004
 *
 * The documents defining a structure are hidden until the person shows them,
 * for a choice stored before the group existed too; the group draws nothing
 * on an instance without `structures`. DO_0042_003
 */
export const DOCUMENTS_FILTER: LibraryFilter = {
  search: "Search titles",
  groups: [
    { name: "kind", label: "Kind" },
    { name: "started", label: "Started by an agent" },
    { name: "unnamed", label: "Unnamed" },
    { name: STRUCTURE, label: "Structures" },
  ],
  orders: [
    { id: "title", label: "Title A–Z", by: "label-ascending" },
    { id: "title-desc", label: "Title Z–A", by: "label-descending" },
    { id: "changed", label: "Last changed first", by: "key-descending" },
    { id: "created", label: "Newest first", by: "key-descending" },
  ],
  defaultOrder: "title",
  defaultHidden: [`${STRUCTURE}:${STRUCTURE}`],
  noMatch: "No documents match",
};
