import { $, component$, useContext, useSignal, useStore, useTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";
import { describeOutcome, readOutcome } from "~/extensions/documents/views/documents-client";

import type { WorkRecord } from "../../lib/work";
import type { FetchAnswer } from "../../server/fetch";
import type { SourcesListing } from "../../contributions.server";
import { lineOf, matches } from "../record-form";
import "../bibliography.css";

/**
 * The Sources section (`BO_0291_019`): every work of the instance's
 * bibliography, each opening in its own tab, a search over authors, title,
 * year, container and tags, and the section's own `+`, which toggles the
 * *Add source* form — the Investigations section's idiom. Submitting the
 * form fetches a record for what was typed through this extension's route;
 * the record is shown to confirm before anything is written, a page that
 * listed several is shown as its candidates to choose from, and a refusal
 * is shown in the route's own words. Confirming writes the work as truth and
 * opens its tab.
 */

const EMPTY: SourcesListing = { reachable: false, works: [] };

interface Candidates {
  readonly url: string;
  readonly session: string;
  readonly items: Readonly<Record<string, string>>;
}

export const SourcesSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    listing: SourcesListing;
    search: string;
    formOpen: boolean;
    input: string;
    refusal: string;
    busy: boolean;
    preview: WorkRecord | null;
    candidates: Candidates | null;
  }>({
    listing: (data as SourcesListing | null) ?? EMPTY,
    search: "",
    formOpen: false,
    input: "",
    refusal: "",
    busy: false,
    preview: null,
    candidates: null,
  });
  const inputField = useSignal<HTMLInputElement>();

  useTask$(({ track }) => {
    const next = track(() => data) as SourcesListing | null;
    if (next !== null && next !== undefined) state.listing = next;
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/bibliography/sources");
    if (!response.ok) return;
    state.listing = (await response.json()) as SourcesListing;
  });

  const open$ = $((id: string, title: string) => bridge.openTarget$({ kind: "bibliography:work", itemId: id, title }));

  const ask$ = $(async (body: Record<string, unknown>) => {
    state.busy = true;
    state.refusal = "";
    try {
      const response = await fetch("/api/x/bibliography/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused", detail: `the server answered ${response.status}` }))) as FetchAnswer;
      if (answer.outcome === "record") {
        state.preview = answer.record;
        state.candidates = null;
      } else if (answer.outcome === "candidates") {
        state.candidates = { url: answer.url, session: answer.session, items: answer.items };
        state.preview = null;
      } else {
        state.refusal = answer.detail;
      }
    } catch {
      state.refusal = "The record could not be fetched: the server did not answer.";
    } finally {
      state.busy = false;
    }
  });

  const fetch$ = $(async () => {
    const input = state.input.trim();
    if (input === "") {
      state.refusal = "Paste a DOI, an ISBN, an arXiv id or a link.";
      return;
    }
    state.preview = null;
    state.candidates = null;
    await ask$({ input });
  });

  const choose$ = $(async (key: string) => {
    const candidates = state.candidates;
    if (candidates === null) return;
    await ask$({ selection: { url: candidates.url, session: candidates.session, items: { [key]: candidates.items[key] ?? "" } } });
  });

  const add$ = $(async () => {
    const record = state.preview;
    if (record === null) return;
    state.busy = true;
    state.refusal = "";
    try {
      const outcome = await readOutcome<{ workId: string; revisionId: string }>(
        await fetch("/api/x/bibliography/commands", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: "addWork", record }),
        }),
      );
      if (outcome.outcome !== "success") {
        state.refusal = describeOutcome(outcome);
        return;
      }
      state.preview = null;
      state.formOpen = false;
      state.input = "";
      await refresh$();
      await open$(outcome.result.workId, record.title);
    } catch {
      state.refusal = "The source could not be added: the server did not answer.";
    } finally {
      state.busy = false;
    }
  });

  const works = state.listing.works.filter((work) => matches(work.record, state.search));
  const preview = state.preview === null ? null : lineOf(state.preview);
  return (
    <>
      <div class="library-section-actions">
        <button
          type="button"
          class="library-action library-action--body library-action--icon"
          aria-label="Add source"
          aria-expanded={state.formOpen}
          aria-controls="library-new-source"
          data-new-source
          onClick$={() => {
            state.formOpen = !state.formOpen;
            state.refusal = "";
            inputField.value?.focus();
          }}
        >
          <Icon name="plus" />
        </button>
      </div>
      <form id="library-new-source" class="library-create" data-new-source-form hidden={!state.formOpen} preventdefault:submit onSubmit$={() => fetch$()}>
        <label class="library-create__field">
          <span>DOI, ISBN, arXiv id or link</span>
          <input
            ref={inputField}
            type="text"
            name="input"
            autocomplete="off"
            placeholder="10.1038/nature12373"
            value={state.input}
            disabled={state.busy}
            onInput$={(_, element) => {
              state.input = element.value;
            }}
          />
        </label>
        <button type="submit" class="bib-button" disabled={state.busy}>
          {state.busy ? "Fetching…" : "Fetch the record"}
        </button>
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
        {preview !== null && state.preview !== null && (
          <div class="bib-preview" data-source-preview>
            <strong>{preview.title}</strong>
            <span class="bib-row__who">
              {preview.who}
              {preview.year !== "" ? ` (${preview.year})` : ""}
              {state.preview["container-title"] !== undefined ? ` · ${state.preview["container-title"]}` : ""}
            </span>
            <div class="bib-preview__actions">
              <button type="button" class="bib-button bib-button--primary" disabled={state.busy} onClick$={() => add$()}>
                Add to sources
              </button>
              <button
                type="button"
                class="bib-button"
                disabled={state.busy}
                onClick$={() => {
                  state.preview = null;
                }}
              >
                Not this one
              </button>
            </div>
          </div>
        )}
        {state.refusal !== "" && (
          <p class="library-refusal" role="alert">
            {state.refusal}
          </p>
        )}
      </form>
      <div class="bib-search">
        <input
          type="search"
          aria-label="Search sources"
          placeholder="Search sources"
          value={state.search}
          onInput$={(_, element) => {
            state.search = element.value;
          }}
        />
      </div>
      {!state.listing.reachable && <p class="library-refusal">The bibliography could not be read.</p>}
      <ul class="library-list">
        {works.map((work) => {
          const line = lineOf(work.record);
          return (
            <li key={work.workId}>
              <button type="button" class="library-entry" aria-current={activeItemId === work.workId ? "true" : undefined} onClick$={() => open$(work.workId, work.record.title)}>
                <span class="library-entry__label bib-row">
                  <span class="bib-row__title">{line.title}</span>
                  <span class="bib-row__who">
                    {line.who}
                    {line.year !== "" ? ` (${line.year})` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
});
