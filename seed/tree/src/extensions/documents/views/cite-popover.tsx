import { component$, useSignal, useStore, useVisibleTask$, type QRL } from "@builder.io/qwik";

import { workLine } from "../lib/citation-label";

/**
 * The source chooser (`BO_0291_024`; user decisions 2026-09-23: a popover,
 * and one that opens directly below the bar's Cite control): the body of the
 * bar's popover action, drawn by the shell inside the panel it places under
 * the control, closed by the shell on Escape and a press outside. It holds a
 * search, focused on opening, and the bibliography's works as buttons;
 * pressing one, or Enter for the first match, writes the citation and closes
 * the panel. It reads the works itself when it opens, so a bibliography that
 * is not there, or empty, is said in words where the reader is looking.
 */
export interface WorkChoice {
  readonly workId: string;
  readonly label: string;
}

export const CitePopover = component$<{
  cite$: QRL<(workId: string) => void>;
  close$: QRL<() => void>;
}>(({ cite$, close$ }) => {
  const state = useStore<{ works: WorkChoice[]; search: string; refusal: string; loading: boolean }>({
    works: [],
    search: "",
    refusal: "",
    loading: true,
  });
  const field = useSignal<HTMLInputElement>();

  useVisibleTask$(async () => {
    field.value?.focus();
    try {
      const response = await fetch("/api/x/bibliography/works");
      if (!response.ok) {
        state.refusal = response.status === 404 ? "No bibliography on this instance." : `The sources could not be read (${response.status}).`;
        return;
      }
      const answer = (await response.json()) as { works?: { workId: string; record: Record<string, unknown> }[] };
      state.works = (answer.works ?? []).map((work) => ({ workId: work.workId, label: workLine(work.record) }));
      if (state.works.length === 0) state.refusal = "No sources yet: add one in the Sources category.";
    } catch {
      state.refusal = "The sources could not be read: the server did not answer.";
    } finally {
      state.loading = false;
    }
  });

  const needle = state.search.trim().toLowerCase();
  const found = state.works.filter((work) => needle === "" || needle.split(/\s+/u).every((word) => work.label.toLowerCase().includes(word)));
  return (
    <div class="cite-popover" data-cite-popover>
      <input
        ref={field}
        class="cite-popover__search"
        data-cite-search
        type="search"
        placeholder="Find a source"
        aria-label="Find a source"
        autocomplete="off"
        value={state.search}
        onInput$={(_, element) => {
          state.search = element.value;
        }}
        onKeyDown$={async (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const first = found[0];
            if (first !== undefined) {
              await cite$(first.workId);
              await close$();
            }
          }
        }}
      />
      {state.refusal !== "" ? (
        <p class="cite-popover__refusal" role="alert">
          {state.refusal}
        </p>
      ) : state.loading ? (
        <p class="cite-popover__refusal">Reading the sources…</p>
      ) : found.length === 0 ? (
        <p class="cite-popover__refusal">No source matches.</p>
      ) : (
        <ul class="cite-popover__list" data-cite-choices>
          {found.map((work) => (
            <li key={work.workId}>
              <button
                type="button"
                class="cite-popover__choice"
                data-cite-choice={work.workId}
                onClick$={async () => {
                  await cite$(work.workId);
                  await close$();
                }}
              >
                {work.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
