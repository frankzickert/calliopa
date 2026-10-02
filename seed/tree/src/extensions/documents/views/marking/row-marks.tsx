import { component$, useContext } from "@builder.io/qwik";

import { passagesIn, proposalReferenceFor, referenceFor, type Marked, type Marking, type RowOf } from "../../lib/references";
import { MarkingContext } from "./use-marking";

/**
 * Marking a row that is not a block of the document: a proposed change, a
 * revealed retired block. BO_0263_005
 *
 * Command mode marks every row the editor draws. Each such row names what it
 * is for the selection to find (`rowMarkAttributes`, read by
 * `passages/selection.ts`), carries its number and its passages' numbers
 * here, and says them in the name of its marking control (`rowMarkingName`).
 * The treatment is the block row's — a dashed outline and a number in the
 * gutter — so marked stays one look beside the proposed and retired ones.
 */

/** The row a marked target stands on. */
export const rowOfMarked = (marked: Marked): RowOf =>
  marked.target === "proposal"
    ? { target: "proposal", item: marked.item ?? "" }
    : marked.target === "retired"
      ? { target: "retired" }
      : {};

/** What the selection reads off a markable row: which block, what it is,
 * and the revision it shows. The row's words are its `[data-mark-text]`. */
export const rowMarkAttributes = (blockId: string, marked: Marked) => ({
  "data-mark-row": blockId,
  "data-mark-target": marked.target,
  "data-mark-group": marked.group,
  "data-mark-item": marked.item,
  "data-mark-revision": marked.revisionId,
  "data-mark-proposer": marked.proposer,
});

/** Reads back what `rowMarkAttributes` wrote. */
export function markedOfRow(row: HTMLElement): Marked {
  const data = row.dataset;
  const target = data.markTarget === "proposal" || data.markTarget === "retired" ? data.markTarget : undefined;
  return {
    ...(target === undefined ? {} : { target }),
    ...(data.markGroup === undefined ? {} : { group: data.markGroup }),
    ...(data.markItem === undefined ? {} : { item: data.markItem }),
    ...(data.markRevision === undefined ? {} : { revisionId: data.markRevision }),
    ...(data.markProposer === undefined ? {} : { proposer: data.markProposer }),
  };
}

/** The numbers standing on one row: its own reference, its passages, and —
 * for an item of a proposal marked whole — that proposal's. BO_0321_009 */
export function rowNumbers(marking: Marking, blockId: string, marked: Marked) {
  const at = rowOfMarked(marked);
  return {
    reference: referenceFor(marking, blockId, at),
    passages: passagesIn(marking, blockId, at).map((passage) => passage.number),
    whole: marked.target === "proposal" && marked.group !== undefined ? proposalReferenceFor(marking, marked.group) : null,
  };
}

/** The name of a row's marking control: `Mark retired block: “…”`, or which
 * reference it is and which passages it holds. */
export function rowMarkingName(what: string, reference: number | null, passages: readonly number[], whole: number | null = null): string {
  const base = reference === null ? `Mark ${what}` : `${what[0]?.toUpperCase() ?? ""}${what.slice(1)}, reference ${reference}`;
  const held = passages.length === 0 ? "" : `, ${passages.length === 1 ? "passage" : "passages"} ${passages.join(", ")}`;
  // An item of a proposal marked whole says which reference that is.
  // BO_0321_009
  const within = whole === null ? "" : `, in proposal reference ${whole}`;
  return `${base}${held}${within}`;
}

/**
 * The numbers on a marked row in command mode: the row's own reference in
 * the gutter, as a block row's, and its passages' numbers, each of which
 * takes its passage back when pressed. Nothing in reading mode.
 */
export const RowMarks = component$<{ blockId: string; marked: Marked }>(({ blockId, marked }) => {
  const { store, removeReference$ } = useContext(MarkingContext);
  if (store.marking.mode !== "command") return null;
  const { reference, passages, whole } = rowNumbers(store.marking, blockId, marked);
  return (
    <>
      {whole !== null && (
        // The proposal it belongs to, marked whole: a quieter number below
        // the row's own. BO_0321_009
        <span class="block-reference block-reference--proposal" data-reference-whole={whole} aria-hidden="true">
          #{whole}
        </span>
      )}
      {reference !== null && (
        <span class="block-reference" aria-hidden="true">
          #{reference}
        </span>
      )}
      {passages.length > 0 && (
        <span class="row-passages">
          {passages.map((number) => (
            <button
              key={number}
              type="button"
              class="passage-number row-passages__number"
              data-row-passage={number}
              aria-label={`Take back passage ${number}`}
              onClick$={() => removeReference$(number)}
            >
              #{number}
            </button>
          ))}
        </span>
      )}
    </>
  );
});
