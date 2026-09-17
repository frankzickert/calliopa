import type { LibraryGlyph, LibraryItem } from "~/contract";
import type { DocumentSummary } from "~/lib/library";
import type { StartedBy } from "../server/assemble";
import { proposerName } from "./proposals";

/** A document as the listing answers it, with the run that started it when
 * nobody has taken it yet (`listDocuments`). BO_0251_011 */
export interface ListedDocumentEntry extends DocumentSummary {
  readonly proposed?: StartedBy;
}

/**
 * A document's row in the library. A started document says who proposed it
 * — the runtime, for the face, and the words the proposal face uses — so the
 * frame draws the row as a proposal (`layout.md` `BO_0251_012`). BO_0251_011
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
    open: { kind: "document", itemId: entry.documentId, title: entry.title },
  };
}
