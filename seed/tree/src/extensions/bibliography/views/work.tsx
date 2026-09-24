import { $, component$, useContext, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import { describeOutcome, readOutcome } from "~/extensions/documents/views/documents-client";

import { WORK_KINDS, type WorkKind, type WorkRecord } from "../lib/work";
import type { WorkView as WorkRead } from "../server/works";
import type { CitingDocument } from "~/extensions/documents/server/cited-by";
import { EMPTY_FORM, formOf, recordOf, type RecordForm } from "./record-form";
import "./bibliography.css";

/**
 * A work's page (`BO_0291_019`, `BO_0291_018`): the record's fields,
 * editable and saved whole against the revision the page read; the work's
 * file — a PDF kept, opened or dropped; where the record came from; and the
 * work's retirement. Every write is the person's press, as a block edit is.
 * *Cited by* lists the documents citing it, each with the words of the blocks
 * that do, and opens a document on a press (`BO_0291_023`).
 */

const KIND_WORDS: Readonly<Record<WorkKind, string>> = {
  "article-journal": "Journal article",
  book: "Book",
  chapter: "Book chapter",
  "paper-conference": "Conference paper",
  thesis: "Thesis",
  report: "Report",
  webpage: "Web page",
  post: "Post",
  dataset: "Dataset",
  software: "Software",
  document: "Document",
};

export const WorkView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    workId: string;
    revisionId: string;
    record: WorkRecord | null;
    form: RecordForm;
    dirty: boolean;
    busy: boolean;
    notice: string;
    saved: string;
    citedBy: readonly CitingDocument[] | null;
  }>({ workId: "", revisionId: "", record: null, form: EMPTY_FORM, dirty: false, busy: false, notice: "", saved: "", citedBy: null });
  const fileInput = useSignal<HTMLInputElement>();

  const read$ = $(async (id: string) => {
    state.notice = "";
    const outcome = await readOutcome<WorkRead>(await fetch(`/api/x/bibliography/works/${encodeURIComponent(id)}`));
    if (outcome.outcome !== "success") {
      state.record = null;
      state.notice = describeOutcome(outcome);
      return;
    }
    state.workId = outcome.result.workId;
    state.revisionId = outcome.result.revisionId;
    state.record = outcome.result.record;
    state.form = formOf(outcome.result.record);
    state.dirty = false;
    const citedBy = await readOutcome<readonly CitingDocument[]>(await fetch(`/api/x/bibliography/works/${encodeURIComponent(id)}/cited-by`));
    state.citedBy = citedBy.outcome === "success" ? citedBy.result : null;
  });

  useVisibleTask$(({ track }) => {
    const id = track(() => tab.itemId);
    if (id !== null && id !== "") void read$(id);
  });

  const set$ = $((field: keyof RecordForm, value: string) => {
    state.form = { ...state.form, [field]: value };
    state.dirty = true;
    state.saved = "";
  });

  const save$ = $(async () => {
    if (state.record === null) return;
    state.busy = true;
    state.notice = "";
    try {
      const outcome = await readOutcome<{ revisionId: string }>(
        await fetch("/api/x/bibliography/commands", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: "reviseWork", workId: state.workId, baseRevisionId: state.revisionId, record: recordOf(state.form, state.record) }),
        }),
      );
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return;
      }
      state.saved = "Saved.";
      await read$(state.workId);
      await bridge.targetChanged$();
    } finally {
      state.busy = false;
    }
  });

  const upload$ = $(async (file: File) => {
    state.busy = true;
    state.notice = "";
    try {
      const outcome = await readOutcome<{ revisionId: string }>(
        await fetch(`/api/x/bibliography/works/${encodeURIComponent(state.workId)}/file`, {
          method: "POST",
          headers: { "content-type": file.type || "application/pdf", "x-calliopa-filename": encodeURIComponent(file.name), "x-calliopa-base-revision": state.revisionId },
          body: file,
        }),
      );
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return;
      }
      await read$(state.workId);
    } finally {
      state.busy = false;
    }
  });

  const dropFile$ = $(async () => {
    state.busy = true;
    state.notice = "";
    try {
      const outcome = await readOutcome<{ revisionId: string }>(
        await fetch(`/api/x/bibliography/works/${encodeURIComponent(state.workId)}/file`, {
          method: "DELETE",
          headers: { "x-calliopa-base-revision": state.revisionId },
        }),
      );
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return;
      }
      await read$(state.workId);
    } finally {
      state.busy = false;
    }
  });

  const retire$ = $(async () => {
    state.busy = true;
    state.notice = "";
    try {
      const outcome = await readOutcome<{ revisionId: string }>(
        await fetch("/api/x/bibliography/commands", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: "retireWork", workId: state.workId, baseRevisionId: state.revisionId }),
        }),
      );
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return;
      }
      await bridge.targetGone$(state.workId);
    } finally {
      state.busy = false;
    }
  });

  const field = (label: string, name: keyof RecordForm, wide = false) => (
    <label class={`bib-work__field${wide ? " bib-work__field--wide" : ""}`}>
      <span>{label}</span>
      <input type="text" value={state.form[name]} disabled={state.busy} onInput$={(_, element) => set$(name, element.value)} />
    </label>
  );
  const record = state.record;
  const file = record?.file as { filename?: string; size?: number } | undefined;
  return (
    <article class="bib-work" data-work-view>
      {record === null ? (
        <p class="bib-work__notice">{state.notice === "" ? "Reading the source…" : state.notice}</p>
      ) : (
        <>
          <form
            class="bib-work__grid"
            preventdefault:submit
            onSubmit$={() => save$()}
          >
            {field("Title", "title", true)}
            <label class="bib-work__field">
              <span>Kind</span>
              <select value={state.form.kind} disabled={state.busy} onChange$={(_, element) => set$("kind", element.value)}>
                {WORK_KINDS.map((kind) => (
                  <option key={kind} value={kind} selected={kind === state.form.kind}>
                    {KIND_WORDS[kind]}
                  </option>
                ))}
              </select>
            </label>
            {field("Year", "year")}
            <label class="bib-work__field bib-work__field--wide">
              <span>Authors, one per line as Family, Given</span>
              <textarea value={state.form.authors} disabled={state.busy} onInput$={(_, element) => set$("authors", element.value)} />
            </label>
            <label class="bib-work__field bib-work__field--wide">
              <span>Editors, one per line</span>
              <textarea value={state.form.editors} disabled={state.busy} onInput$={(_, element) => set$("editors", element.value)} />
            </label>
            {field("Journal, book or site", "containerTitle", true)}
            {field("Volume", "volume")}
            {field("Issue", "issue")}
            {field("Pages", "page")}
            {field("Publisher", "publisher")}
            {field("Place", "publisherPlace")}
            {field("DOI", "doi")}
            {field("ISBN", "isbn")}
            {field("URL", "url", true)}
            <label class="bib-work__field bib-work__field--wide">
              <span>Abstract</span>
              <textarea value={state.form.abstract} disabled={state.busy} onInput$={(_, element) => set$("abstract", element.value)} />
            </label>
            {field("Tags, separated by commas", "tags", true)}
            <div class="bib-work__actions bib-work__field--wide">
              <button type="submit" class="bib-button bib-button--primary" disabled={state.busy || !state.dirty}>
                Save
              </button>
              {state.saved !== "" && <p class="bib-work__saved">{state.saved}</p>}
            </div>
          </form>
          <div class="bib-work__file" data-work-file>
            {file !== undefined ? (
              <>
                <a href={`/api/x/bibliography/works/${encodeURIComponent(state.workId)}/file`} target="_blank" rel="noopener">
                  {file.filename ?? "Open the PDF"}
                </a>
                <button type="button" class="bib-button" disabled={state.busy} onClick$={() => dropFile$()}>
                  Drop the file
                </button>
              </>
            ) : (
              <>
                <span class="bib-row__who">No file yet.</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf"
                  disabled={state.busy}
                  onChange$={(_, element) => {
                    const chosen = element.files?.[0];
                    if (chosen !== undefined) void upload$(chosen);
                  }}
                />
              </>
            )}
          </div>
          {record.fetched !== undefined && (
            <p class="bib-work__fetched">
              Record fetched from {record.fetched.from} by {record.fetched.by} on {record.fetched.at.slice(0, 10)}.
            </p>
          )}
          {state.notice !== "" && (
            <p class="bib-work__notice" role="alert">
              {state.notice}
            </p>
          )}
          <section class="bib-cited-by" data-cited-by aria-label="Cited by">
            <h3 class="bib-cited-by__heading">Cited by</h3>
            {state.citedBy === null ? (
              <p class="bib-work__fetched">Reading where it is cited…</p>
            ) : state.citedBy.length === 0 ? (
              <p class="bib-work__fetched">No document cites this source.</p>
            ) : (
              <ul class="bib-cited-by__list">
                {state.citedBy.map((document) => (
                  <li key={document.documentId} class="bib-cited-by__document" data-citing-document={document.documentId}>
                    <button
                      type="button"
                      class="bib-cited-by__title"
                      onClick$={() => bridge.openTarget$({ kind: "documents:document", itemId: document.documentId, title: document.title === "" ? "Untitled" : document.title })}
                    >
                      {document.title === "" ? "Untitled" : document.title}
                    </button>
                    <ul class="bib-cited-by__blocks">
                      {document.citations.map((citation) => (
                        <li key={citation.blockId} class="bib-cited-by__words">
                          {citation.words}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div class="bib-work__actions">
            <button type="button" class="bib-button" disabled={state.busy} onClick$={() => retire$()}>
              Retire this source
            </button>
          </div>
        </>
      )}
    </article>
  );
});
