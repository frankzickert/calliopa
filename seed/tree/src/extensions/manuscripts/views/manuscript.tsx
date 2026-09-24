import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { ViewProps } from "~/components/shell/view-host";
import { describeOutcome, readOutcome } from "~/extensions/documents/views/documents-client";

import { OUTCOME_WORDS, type ManuscriptView as Kept } from "../lib/manuscript";
import "./manuscripts.css";

/**
 * A kept manuscript's page (`BO_0293_022`): the document it was made of and
 * the revision it projects, the venue, when and by whom, the outcome, each
 * file — the PDF to open, the LaTeX source and its references to download —
 * what the projection left out and why, and the typesetting's warnings. A
 * kept manuscript never changes, so the page only reads.
 */
export const ManuscriptPage = component$<ViewProps>(({ tab }) => {
  const state = useStore<{ manuscript: Kept | null; notice: string }>({ manuscript: null, notice: "" });

  const read$ = $(async (id: string) => {
    const outcome = await readOutcome<Kept>(await fetch(`/api/x/manuscripts/manuscripts/${encodeURIComponent(id)}`));
    if (outcome.outcome !== "success") {
      state.manuscript = null;
      state.notice = describeOutcome(outcome);
      return;
    }
    state.manuscript = outcome.result;
    state.notice = "";
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the manuscript is read in the browser with the person's session
  useVisibleTask$(({ track }) => {
    const id = track(() => tab.itemId);
    if (id !== null && id !== "") void read$(id);
  });

  const manuscript = state.manuscript;
  if (manuscript === null) return <section class="manuscript-page">{state.notice !== "" && <p role="alert">{state.notice}</p>}</section>;
  const href = (name: string) => `/api/x/manuscripts/manuscripts/${encodeURIComponent(manuscript.manuscriptId)}/files/${encodeURIComponent(name)}`;
  return (
    <section class="manuscript-page" data-manuscript-page={manuscript.manuscriptId}>
      <h2>{manuscript.title === "" ? "Untitled document" : manuscript.title}</h2>
      <dl class="manuscript-page__facts">
        <dt>Venue</dt>
        <dd data-manuscript-venue>{manuscript.venue}</dd>
        <dt>Revision</dt>
        <dd data-manuscript-revision>{manuscript.revision}</dd>
        <dt>Made</dt>
        <dd>
          <time dateTime={manuscript.made}>{manuscript.made}</time>
          {manuscript.by !== "" && ` by ${manuscript.by}`}
        </dd>
        <dt>Outcome</dt>
        <dd data-manuscript-outcome={manuscript.outcome}>{OUTCOME_WORDS[manuscript.outcome]}</dd>
      </dl>
      <ul class="manuscript-page__files" data-manuscript-files>
        {manuscript.files.map((file) => (
          <li key={file.filename}>
            {/* The PDF opens beside the page; the source and the references
                download. Two links rather than one with conditional
                attributes, which the strict types and the optimizer both
                refuse. */}
            {file.mediaType === "application/pdf" ? (
              <a href={href(file.filename)} data-manuscript-file={file.filename} target="_blank" rel="noopener">
                {file.filename}
              </a>
            ) : (
              <a href={href(file.filename)} data-manuscript-file={file.filename} download={file.filename}>
                {file.filename}
              </a>
            )}
            <span class="manuscript-page__size"> {file.size} bytes</span>
          </li>
        ))}
      </ul>
      {manuscript.omitted.length > 0 && (
        <>
          <h3>Left out</h3>
          <ul data-manuscript-omitted>
            {manuscript.omitted.map((line, at) => (
              <li key={at}>{line}</li>
            ))}
          </ul>
        </>
      )}
      {manuscript.log.length > 0 && (
        <>
          <h3>What the typesetting said</h3>
          <ul class="manuscript-page__log" data-manuscript-log>
            {manuscript.log.map((line, at) => (
              <li key={at}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
});
