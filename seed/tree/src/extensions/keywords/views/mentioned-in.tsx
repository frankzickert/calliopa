import { component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { DocumentPlaceProps } from "~/contract";

import type { MentionedInView } from "../lib/keywords";
import "./keywords.css";

/**
 * *Mentioned in* at the foot of a keyword document (`BO_0301_016`): drawn
 * through the document's `end` place, the reference list's, on a document
 * carrying the keyword role — each mentioning document by title with its
 * mentioning blocks' words, a press opening the document — and nothing on a
 * document that is no keyword or is mentioned nowhere. Derived on every
 * read and stored nowhere: it reads again when the document's data revision
 * moves.
 */
export const MentionedIn = component$<DocumentPlaceProps>(({ documentId, dataRevision }) => {
  const bridge = useContext(ViewBridgeContext, null);
  const state = useStore<{ answer: MentionedInView | null }>({ answer: null });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    track(() => dataRevision);
    if (documentId === "") return;
    const response = await fetch(`/api/x/keywords/keywords/${encodeURIComponent(documentId)}/mentioned-in`).catch(() => null);
    if (response === null || !response.ok) return;
    const answer = (await response.json().catch(() => null)) as { outcome?: string; result?: MentionedInView } | null;
    if (answer?.outcome === "success" && answer.result !== undefined && Array.isArray(answer.result.documents)) state.answer = answer.result;
  });

  const answer = state.answer;
  if (answer === null || answer.keyword === null || answer.documents.length === 0) return null;
  return (
    <section class="keywords-mentioned" data-mentioned-in aria-labelledby={`mentioned-in-${documentId}`}>
      <h3 id={`mentioned-in-${documentId}`} class="keywords-mentioned__heading">
        Mentioned in
      </h3>
      <ul class="keywords-mentioned__list">
        {answer.documents.map((document) => (
          <li key={document.documentId} data-mentioning-document={document.documentId}>
            <button
              type="button"
              class="keywords-mentioned__document"
              onClick$={() => bridge?.openTarget$({ kind: "documents:document", itemId: document.documentId, title: document.title })}
            >
              {document.title === "" ? "Untitled" : document.title}
            </button>
            {document.mentions.map((mention) => (
              <p key={mention.blockId} class="keywords-mentioned__words" data-mentioning-block={mention.blockId}>
                {mention.words}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
});
