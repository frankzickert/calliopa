import { component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { DocumentPlaceProps } from "~/contract";

import type { References } from "../server/references";
import "./bibliography.css";

/**
 * A document's reference list (`BO_0291_027`): drawn after the last block
 * through the document's `end` place (`ui.shell`'s `BO_0291_031`), its cited
 * works in the document's style — in citation order beside their labels for
 * a numeric style, by author with a hanging indent for the others — each
 * entry rendered by citeproc-js (`BO_0291_020`). Derived on every read and stored nowhere: it reads again when the
 * document's data revision moves, a work cited nowhere is in no list, and a
 * document citing nothing draws nothing. It is not a block and cannot be
 * edited, selected as one or cited itself.
 */
export const ReferenceList = component$<DocumentPlaceProps>(({ documentId, dataRevision }) => {
  const state = useStore<{ answer: References | null }>({ answer: null });

  useVisibleTask$(async ({ track }) => {
    track(() => dataRevision);
    if (documentId === "") return;
    try {
      const response = await fetch(`/api/x/bibliography/references?document=${encodeURIComponent(documentId)}`);
      if (!response.ok) return;
      const answer = (await response.json()) as { outcome?: string; result?: References };
      if (answer.outcome === "success" && answer.result !== undefined) state.answer = answer.result;
    } catch {
      // A list that cannot be read is not drawn; the citations still stand.
    }
  });

  const references = state.answer?.references ?? [];
  if (references.length === 0) return null;
  return (
    <section class="bib-references" data-reference-list aria-labelledby={`references-${documentId}`}>
      <h3 id={`references-${documentId}`} class="bib-references__heading">
        References
      </h3>
      <ol class="bib-references__list">
        {references.map((reference) => (
          <li
            key={reference.workId}
            class={`bib-references__entry${reference.label === undefined ? " bib-references__entry--hanging" : ""}`}
            id={`reference-${reference.workId}`}
            data-reference={reference.workId}
          >
            {reference.label !== undefined && <span class="bib-references__label">{reference.label}</span>}
            <span class="bib-references__text">
              {reference.entry.map((segment, index) => (segment.italic === true ? <em key={index}>{segment.text}</em> : <span key={index}>{segment.text}</span>))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
});
