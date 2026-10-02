import { component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { DocumentPlaceProps } from "~/contract";

import type { MentionedInView } from "../lib/keywords";
import "./keywords.css";

/** How many blocks mention the keyword, over every mentioning document. */
export const mentionCount = (answer: MentionedInView): number =>
  answer.documents.reduce((count, document) => count + document.mentions.length, 0);

/**
 * The mentions line in a keyword document's header (`documents`' `DO_0030`,
 * `DO_0030_006`), this extension's row in the `title` place: on a document
 * carrying *Keyword* that is mentioned anywhere, *Mentioned in N blocks*; a
 * press unfolds the mentioning blocks under it, grouped by document, each
 * document by title and each block by its first words, a press opening that
 * document; a second press folds it. It is the one place a keyword document
 * lists where it is mentioned (`DO_0030_Q8`). Nothing on another document,
 * on one mentioned nowhere, or in the compact header. Derived on every read
 * and stored nowhere: it reads again when the document's data revision moves.
 */
export const MentionsLine = component$<DocumentPlaceProps>(({ documentId, dataRevision, form }) => {
  const bridge = useContext(ViewBridgeContext, null);
  const state = useStore<{ answer: MentionedInView | null; open: boolean }>({ answer: null, open: false });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    track(() => dataRevision);
    if (documentId === "" || form === "compact") return;
    const response = await fetch(`/api/x/keywords/keywords/${encodeURIComponent(documentId)}/mentioned-in`).catch(() => null);
    if (response === null || !response.ok) return;
    const answer = (await response.json().catch(() => null)) as { outcome?: string; result?: MentionedInView } | null;
    if (answer?.outcome === "success" && answer.result !== undefined && Array.isArray(answer.result.documents)) state.answer = answer.result;
  });

  const answer = state.answer;
  if (form === "compact" || answer === null || answer.keyword === null || answer.documents.length === 0) return null;
  const count = mentionCount(answer);
  const listId = `mentions-${documentId}`;
  return (
    <div class="keywords-mentions" data-keyword-mentions>
      <button
        type="button"
        class="keywords-mentions__count"
        aria-expanded={state.open ? "true" : "false"}
        aria-controls={listId}
        data-mentions-toggle
        onClick$={() => {
          state.open = !state.open;
        }}
      >
        Mentioned in {count} {count === 1 ? "block" : "blocks"}
      </button>
      {state.open && (
        <ul id={listId} class="keywords-mentions__list" data-mentions-list>
          {answer.documents.map((document) => (
            <li key={document.documentId} data-mentioning-document={document.documentId}>
              <button
                type="button"
                class="keywords-mentions__document"
                onClick$={() => bridge?.openTarget$({ kind: "documents:document", itemId: document.documentId, title: document.title })}
              >
                {document.title === "" ? "Untitled" : document.title}
              </button>
              {document.mentions.map((mention) => (
                <p key={mention.blockId} class="keywords-mentions__words" data-mentioning-block={mention.blockId}>
                  {mention.words}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
