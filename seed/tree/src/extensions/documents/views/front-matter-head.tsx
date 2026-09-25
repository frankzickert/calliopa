import { $, component$, useStore, useTask$, type QRL } from "@builder.io/qwik";

import type { FrontMatter } from "../lib/front-matter";
import { addWord, authorsOf, isBlank, removeAffiliation, removeKeyword, rowsOf, withPart, type AuthorRow } from "../lib/front-matter-edit";
import type { DocumentState } from "./block-editor";

/**
 * The manuscript's head, edited where it is drawn (`BO_0293_016`, its fields
 * reshaped under `BO_0293_025`, user decision 2026-09-25): the affiliations
 * and the keywords as chips — a word entered with Enter joins the list, each
 * chip has its `×` — the authors as rows of a name, an email, one checkbox per
 * affiliation the document lists and the corresponding mark, with *Add
 * author* beneath, and the venue as a word. Every settled edit writes the
 * whole front matter through `save$`, which keeps the other parts and reads
 * the document back, so the head above redraws. A row nothing has been typed
 * into is not yet an author and writes nothing; a row with an email or an
 * affiliation but no name is refused on the notice line. The inspector
 * contributes no action (CA_0053), so the fields stand here, above the first
 * block, where the user's answer to BO_0293_Q3 draws the head.
 */
/** The front matter as the document carries it now; at module scope, so a
 * handler captures the store and not a function. */
const frontOf = (editor: DocumentState): FrontMatter => editor.document?.frontMatter ?? {};

export const FrontMatterHead = component$<{ editor: DocumentState; save$: QRL<(next: FrontMatter) => Promise<boolean>> }>(({ editor, save$ }) => {
  const draft = useStore<{ rows: AuthorRow[]; affiliation: string; keyword: string }>({ rows: [], affiliation: "", keyword: "" });

  // The rows follow the document on every read-back; a row still blank is
  // the person's and stays.
  useTask$(({ track }) => {
    const front = track(() => editor.document?.frontMatter);
    draft.rows = [...rowsOf(front?.authors), ...draft.rows.filter(isBlank)];
  });

  const writeRows$ = $(async (rows: AuthorRow[]) => {
    const read = authorsOf(rows);
    if ("failure" in read) {
      editor.notice = read.failure;
      return;
    }
    await save$(withPart(frontOf(editor), { authors: read.authors }));
  });

  const enterWord$ = $(async (part: "affiliations" | "keywords", element: HTMLInputElement) => {
    const list = addWord(frontOf(editor)[part], element.value);
    if (list === null) return;
    if (await save$(withPart(frontOf(editor), { [part]: list }))) {
      element.value = "";
      if (part === "affiliations") draft.affiliation = "";
      else draft.keyword = "";
    }
  });

  const setRow$ = $(async (at: number, change: Partial<AuthorRow>) => {
    const row = draft.rows[at];
    if (row === undefined) return;
    draft.rows = draft.rows.map((entry, index) => (index === at ? { ...entry, ...change } : entry));
    await writeRows$(draft.rows);
  });

  const affiliations = frontOf(editor).affiliations ?? [];
  const keywords = frontOf(editor).keywords ?? [];

  return (
    <details class="document-front" data-document-front>
      <summary>Authors, affiliations, keywords and venue</summary>

      <div class="document-front__part">
        <span class="document-front__label">Affiliations</span>
        <ul class="document-front__chips" data-front-chips="affiliations">
          {affiliations.map((affiliation, at) => (
            <li key={`${at}-${affiliation}`} class="document-front__chip" data-front-chip="affiliations">
              <span>
                <sup>{at + 1}</sup>
                {affiliation}
              </span>
              <button type="button" aria-label={`Remove ${affiliation}`} data-front-remove="affiliations" data-front-at={at} onClick$={() => save$(removeAffiliation(frontOf(editor), at))}>
                ×
              </button>
            </li>
          ))}
          <li>
            <input
              data-front-field="affiliations"
              placeholder="Add an affiliation and press Enter"
              value={draft.affiliation}
              onInput$={(_: Event, element: HTMLInputElement) => {
                draft.affiliation = element.value;
              }}
              onKeyDown$={(event: KeyboardEvent, element: HTMLInputElement) => {
                if (event.key === "Enter") void enterWord$("affiliations", element);
              }}
            />
          </li>
        </ul>
      </div>

      <div class="document-front__part">
        <span class="document-front__label">Keywords</span>
        <ul class="document-front__chips" data-front-chips="keywords">
          {keywords.map((keyword, at) => (
            <li key={`${at}-${keyword}`} class="document-front__chip" data-front-chip="keywords">
              <span>{keyword}</span>
              <button type="button" aria-label={`Remove ${keyword}`} data-front-remove="keywords" data-front-at={at} onClick$={() => save$(removeKeyword(frontOf(editor), at))}>
                ×
              </button>
            </li>
          ))}
          <li>
            <input
              data-front-field="keywords"
              placeholder="Add a keyword and press Enter"
              value={draft.keyword}
              onInput$={(_: Event, element: HTMLInputElement) => {
                draft.keyword = element.value;
              }}
              onKeyDown$={(event: KeyboardEvent, element: HTMLInputElement) => {
                if (event.key === "Enter") void enterWord$("keywords", element);
              }}
            />
          </li>
        </ul>
      </div>

      <div class="document-front__part">
        <span class="document-front__label">Authors</span>
        <ol class="document-front__authors" data-front-authors>
          {draft.rows.map((row, at) => (
            <li key={at} class="document-front__author" data-front-author={at}>
              <input
                type="text"
                data-front-author-name={at}
                placeholder="Name"
                value={row.name}
                onChange$={(_: Event, element: HTMLInputElement) => setRow$(at, { name: element.value })}
              />
              <input
                type="email"
                data-front-author-email={at}
                placeholder="Email"
                value={row.email}
                onChange$={(_: Event, element: HTMLInputElement) => setRow$(at, { email: element.value })}
              />
              {affiliations.length > 0 && (
                <span class="document-front__author-affiliations">
                  {affiliations.map((affiliation, place) => (
                    <label key={`${place}-${affiliation}`}>
                      <input
                        type="checkbox"
                        data-front-author-affiliation={`${at}:${place}`}
                        checked={row.affiliations.includes(place)}
                        onChange$={(_: Event, element: HTMLInputElement) =>
                          setRow$(at, { affiliations: element.checked ? [...row.affiliations.filter((entry) => entry !== place), place] : row.affiliations.filter((entry) => entry !== place) })
                        }
                      />
                      <sup>{place + 1}</sup>
                      {affiliation}
                    </label>
                  ))}
                </span>
              )}
              <label>
                <input type="checkbox" data-front-author-corresponding={at} checked={row.corresponding} onChange$={(_: Event, element: HTMLInputElement) => setRow$(at, { corresponding: element.checked })} />
                corresponding
              </label>
              <button
                type="button"
                aria-label="Remove author"
                data-front-author-remove={at}
                onClick$={async () => {
                  const removed = draft.rows[at];
                  draft.rows = draft.rows.filter((_, index) => index !== at);
                  if (removed !== undefined && !isBlank(removed)) await writeRows$(draft.rows);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          data-front-author-add
          onClick$={() => {
            draft.rows = [...draft.rows, { name: "", email: "", affiliations: [], corresponding: false }];
          }}
        >
          Add author
        </button>
      </div>

      <label class="document-front__part document-front__venue">
        <span class="document-front__label">Venue</span>
        <input data-front-field="venue" placeholder="A venue's name, a word" value={frontOf(editor).venue ?? ""} onChange$={(_: Event, element: HTMLInputElement) => save$(withPart(frontOf(editor), { venue: element.value.trim() }))} />
      </label>
    </details>
  );
});
