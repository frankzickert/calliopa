import { $, component$, useContext, useStore } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import { describeOutcome, readOutcome } from "~/extensions/documents/views/documents-client";

import { FRONT_KINDS, WORK_KINDS, kindWords, type WorkKind, type WorkRecord } from "../lib/work";
import type { FetchAnswer } from "../server/fetch";
import { EMPTY_FORM, formOf, recordOf, type RecordForm } from "./record-form";
import "./bibliography.css";

/**
 * *Add source* (`BO_0313_021`), opened by the `+` on *Roles → Source*: a
 * source of any kind. The eight kinds a person cites most stand up front —
 * paper, book, web page, interview, conversation, dataset, software and
 * report — and every other CSL type behind *More* (`BO_0313_Q2`). A DOI, an
 * ISBN, an arXiv id or a link is fetched to fill the fields, a page listing
 * several shown as its candidates to choose from, a refusal shown in the
 * route's own words; a source with neither — an interview, a conversation —
 * is typed in. Adding writes the source document and opens it, where its
 * fields stand in the inspector and its body holds the person's notes.
 */

interface Candidates {
  readonly url: string;
  readonly session: string;
  readonly items: Readonly<Record<string, string>>;
}

const MORE_KINDS: readonly WorkKind[] = WORK_KINDS.filter((kind) => !FRONT_KINDS.includes(kind)).sort((left, right) =>
  kindWords(left).localeCompare(kindWords(right)),
);

export const NewSourceView = component$<ViewProps>(() => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    form: RecordForm;
    kept: Pick<WorkRecord, "fetched" | "accessed"> | null;
    input: string;
    busy: boolean;
    notice: string;
    candidates: Candidates | null;
  }>({ form: { ...EMPTY_FORM }, kept: null, input: "", busy: false, notice: "", candidates: null });

  const set$ = $((field: keyof RecordForm, value: string) => {
    state.form = { ...state.form, [field]: value };
  });

  const ask$ = $(async (body: Record<string, unknown>) => {
    state.busy = true;
    state.notice = "";
    try {
      const response = await fetch("/api/x/bibliography/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused", detail: `the server answered ${response.status}` }))) as FetchAnswer;
      if (answer.outcome === "record") {
        state.form = formOf(answer.record);
        state.kept = {
          ...(answer.record.fetched === undefined ? {} : { fetched: answer.record.fetched }),
          ...(answer.record.accessed === undefined ? {} : { accessed: answer.record.accessed }),
        };
        state.candidates = null;
      } else if (answer.outcome === "candidates") {
        state.candidates = { url: answer.url, session: answer.session, items: answer.items };
      } else {
        state.notice = answer.detail;
      }
    } catch {
      state.notice = "The record could not be fetched: the server did not answer.";
    } finally {
      state.busy = false;
    }
  });

  const fetch$ = $(async () => {
    const input = state.input.trim();
    if (input === "") {
      state.notice = "Paste a DOI, an ISBN, an arXiv id or a link, or type the fields.";
      return;
    }
    state.candidates = null;
    await ask$({ input });
  });

  const choose$ = $(async (key: string) => {
    const candidates = state.candidates;
    if (candidates === null) return;
    await ask$({ selection: { url: candidates.url, session: candidates.session, items: { [key]: candidates.items[key] ?? "" } } });
  });

  const add$ = $(async () => {
    if (state.form.title.trim() === "") {
      state.notice = "A source carries a title.";
      return;
    }
    state.busy = true;
    state.notice = "";
    try {
      const record = recordOf(state.form, state.kept ?? undefined);
      const outcome = await readOutcome<{ workId: string; revisionId: string }>(
        await fetch("/api/x/bibliography/commands", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: "addWork", record }),
        }),
      );
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return;
      }
      const title = state.form.title.trim();
      state.form = { ...EMPTY_FORM };
      state.kept = null;
      state.input = "";
      await bridge.openTarget$({ kind: "documents:document", itemId: outcome.result.workId, title });
    } catch {
      state.notice = "The source could not be added: the server did not answer.";
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
  const more = MORE_KINDS.includes(state.form.kind);
  return (
    <article class="bib-work" data-new-source-view>
      <h2 class="bib-work__heading">Add source</h2>
      <div class="bib-kinds" role="radiogroup" aria-label="Kind" data-source-kinds>
        {FRONT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            class="bib-kind"
            aria-checked={state.form.kind === kind ? "true" : "false"}
            data-source-kind={kind}
            disabled={state.busy}
            onClick$={() => set$("kind", kind)}
          >
            {kindWords(kind)}
          </button>
        ))}
        <label class="bib-kind bib-kind--more" data-current={more ? "true" : undefined}>
          <span>More</span>
          <select
            aria-label="More kinds"
            data-source-more
            disabled={state.busy}
            onChange$={(_, element) => {
              if (element.value !== "") void set$("kind", element.value);
            }}
          >
            <option value="" selected={!more}>
              …
            </option>
            {MORE_KINDS.map((kind) => (
              <option key={kind} value={kind} selected={state.form.kind === kind}>
                {kindWords(kind)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form class="bib-work__fetch" preventdefault:submit onSubmit$={() => fetch$()}>
        <label class="bib-work__field bib-work__field--wide">
          <span>DOI, ISBN, arXiv id or link, to fill the fields</span>
          <input
            type="text"
            name="input"
            autocomplete="off"
            placeholder="10.1038/nature12373"
            value={state.input}
            disabled={state.busy}
            data-source-input
            onInput$={(_, element) => {
              state.input = element.value;
            }}
          />
        </label>
        <button type="submit" class="bib-button" disabled={state.busy}>
          {state.busy ? "Fetching…" : "Fetch the record"}
        </button>
      </form>
      {state.candidates !== null && (
        <ul class="bib-candidates" data-source-candidates>
          {Object.entries(state.candidates.items).map(([key, title]) => (
            <li key={key}>
              <button type="button" disabled={state.busy} onClick$={() => choose$(key)}>
                {title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form class="bib-work__grid" preventdefault:submit onSubmit$={() => add$()}>
        {field("Title", "title", true)}
        <label class="bib-work__field bib-work__field--wide">
          <span>Authors, one per line as Family, Given</span>
          <textarea value={state.form.authors} disabled={state.busy} onInput$={(_, element) => set$("authors", element.value)} />
        </label>
        {field("Date", "year")}
        {field("Journal, book, site or programme", "containerTitle", true)}
        {field("Publisher", "publisher")}
        {field("Place", "publisherPlace")}
        {field("Volume", "volume")}
        {field("Issue", "issue")}
        {field("Pages", "page")}
        {field("DOI", "doi")}
        {field("ISBN", "isbn")}
        {field("URL", "url", true)}
        <div class="bib-work__actions bib-work__field--wide">
          <button type="submit" class="bib-button bib-button--primary" disabled={state.busy} data-add-source>
            Add source
          </button>
        </div>
      </form>
      {state.notice !== "" && (
        <p class="bib-work__notice" role="alert">
          {state.notice}
        </p>
      )}
    </article>
  );
});
