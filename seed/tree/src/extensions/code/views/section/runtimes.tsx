import { $, component$, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import type { SectionProps } from "~/contract";

import { idleWords, type RuntimeListing, type RuntimeRecord } from "../../lib/types";
import { OTHER_IMAGE, SUGGESTED_IMAGES } from "../../lib/images";

/**
 * The Runtimes section (`BO_0289_019`): every runtime the instance holds,
 * with its name, image, kernel, state, how long it has been idle and the
 * sessions open in it, for everyone; and for the owner the form that makes
 * one from an image and the controls that start, stop and remove it. A
 * runtime being made is re-read until it runs or fails; a failed one says
 * why until the owner removes it.
 */
const EMPTY: RuntimeListing = { reachable: false, owner: false, runtimes: [] };

const MAKING = new Set(["pulling", "inspecting", "creating"]);

export const RuntimesSection = component$<SectionProps>(({ data }) => {
  const state = useStore<{
    listing: RuntimeListing;
    formOpen: boolean;
    name: string;
    /** The choice among the suggested images, or OTHER_IMAGE for the typed one. */
    choice: string;
    image: string;
    kernelspec: string;
    refusal: string;
    busy: boolean;
    now: number;
  }>({
    listing: (data as RuntimeListing | null) ?? EMPTY,
    formOpen: false,
    name: "",
    choice: SUGGESTED_IMAGES[0]?.image ?? OTHER_IMAGE,
    image: "",
    kernelspec: "",
    refusal: "",
    busy: false,
    now: Date.now(),
  });

  useTask$(({ track }) => {
    const next = track(() => data) as RuntimeListing | null;
    if (next !== null && next !== undefined) state.listing = next;
  });

  const refresh$ = $(async () => {
    const answer = await fetch("/api/x/code/runtimes");
    if (!answer.ok) return;
    state.listing = (await answer.json()) as RuntimeListing;
    state.now = Date.now();
  });

  // A runtime being made is re-read until it is not.
  // eslint-disable-next-line qwik/no-use-visible-task -- the poll is the browser's
  useVisibleTask$(({ track, cleanup }) => {
    const making = track(() => state.listing.runtimes.some((record) => MAKING.has(record.state)));
    if (!making) return;
    const timer = setInterval(() => void refresh$(), 2000);
    cleanup(() => clearInterval(timer));
  });

  const act$ = $(async (path: string, method: string, body?: unknown) => {
    state.busy = true;
    state.refusal = "";
    const answer = await fetch(`/api/x/code/${path}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    state.busy = false;
    if (!answer.ok) {
      state.refusal = ((await answer.json().catch(() => ({}))) as { error?: string }).error ?? `The kernel answered ${answer.status}.`;
      return false;
    }
    await refresh$();
    return true;
  });

  const make$ = $(async () => {
    const image = state.choice === OTHER_IMAGE ? state.image.trim() : state.choice;
    const made = await act$("runtimes", "POST", {
      name: state.name.trim(),
      image,
      ...(state.kernelspec.trim() === "" ? {} : { kernelspec: state.kernelspec.trim() }),
    });
    if (made) {
      state.formOpen = false;
      state.name = "";
      state.image = "";
      state.kernelspec = "";
    }
  });

  const row = (record: RuntimeRecord) => (
    <li key={record.id} class="code-runtime" data-code-runtime={record.id} data-code-runtime-state={record.state}>
      <div class="code-runtime__line">
        <span class="code-runtime__name">{record.name}</span>
        <span class="code-runtime__state" data-code-runtime-words>
          {record.state}
          {record.kernelspec !== null ? ` · ${record.kernelspec.displayName}` : ""}
          {record.state === "running" ? ` · ${record.sessions.length} session${record.sessions.length === 1 ? "" : "s"}` : ""}
          {record.state === "running" && idleWords(record, state.now) !== "" ? ` · ${idleWords(record, state.now)}` : ""}
        </span>
      </div>
      <div class="code-runtime__image">{record.image}</div>
      {record.error !== null && (
        <div class="code-runtime__error" data-code-runtime-error>
          {record.error}
        </div>
      )}
      {state.listing.owner && (
        <div class="code-runtime__controls">
          {record.state === "stopped" && (
            <button type="button" class="library-action library-action--body" data-code-runtime-start disabled={state.busy} onClick$={() => act$(`runtimes/${record.id}/start`, "POST")}>
              Start
            </button>
          )}
          {record.state === "running" && (
            <button type="button" class="library-action library-action--body" data-code-runtime-stop disabled={state.busy} onClick$={() => act$(`runtimes/${record.id}/stop`, "POST")}>
              Stop
            </button>
          )}
          {!MAKING.has(record.state) && (
            <button type="button" class="library-action library-action--body" data-code-runtime-remove disabled={state.busy} onClick$={() => act$(`runtimes/${record.id}`, "DELETE")}>
              Remove
            </button>
          )}
        </div>
      )}
    </li>
  );

  if (!state.listing.reachable) {
    return (
      <p class="library-empty" data-code-runtimes-unreachable>
        {state.listing.refusal ?? "This instance runs no code service."}
      </p>
    );
  }
  return (
    <div class="code-runtimes" data-code-runtimes>
      {state.listing.owner && (
        <div class="library-section-actions">
          <button type="button" class="library-action library-action--body" data-code-runtime-new onClick$={() => (state.formOpen = !state.formOpen)}>
            {state.formOpen ? "Cancel" : "New runtime"}
          </button>
        </div>
      )}
      {state.formOpen && (
        <form
          class="library-create"
          data-code-runtime-form
          preventdefault:submit
          onSubmit$={make$}
        >
          <label class="library-create__field">
            Name
            <input value={state.name} onInput$={(_: Event, element: HTMLInputElement) => (state.name = element.value)} data-code-runtime-name required />
          </label>
          <label class="library-create__field">
            Image
            <select
              data-code-runtime-image-choice
              value={state.choice}
              onChange$={(_: Event, element: HTMLSelectElement) => (state.choice = element.value)}
            >
              {SUGGESTED_IMAGES.map((suggested) => (
                <option key={suggested.image} value={suggested.image} selected={state.choice === suggested.image}>
                  {`${suggested.image} — ${suggested.words}`}
                </option>
              ))}
              <option value={OTHER_IMAGE} selected={state.choice === OTHER_IMAGE}>
                Another image…
              </option>
            </select>
          </label>
          {state.choice === OTHER_IMAGE && (
            <label class="library-create__field">
              Image name
              <input
                value={state.image}
                placeholder="registry/name:tag, with a Jupyter kernel in it"
                onInput$={(_: Event, element: HTMLInputElement) => (state.image = element.value)}
                data-code-runtime-image
                required
              />
            </label>
          )}
          <label class="library-create__field">
            Kernel (optional)
            <input value={state.kernelspec} placeholder="python3" onInput$={(_: Event, element: HTMLInputElement) => (state.kernelspec = element.value)} data-code-runtime-kernelspec />
          </label>
          <button type="submit" class="library-action library-action--body" disabled={state.busy || state.name.trim() === "" || (state.choice === OTHER_IMAGE && state.image.trim() === "")} data-code-runtime-make>
            Make it
          </button>
        </form>
      )}
      {state.refusal !== "" && (
        <p class="code-runtimes__refusal" data-code-runtimes-refusal role="alert">
          {state.refusal}
        </p>
      )}
      {state.listing.runtimes.length === 0 ? (
        <p class="library-empty">No runtimes yet.</p>
      ) : (
        <ul class="code-runtimes__list">{state.listing.runtimes.map(row)}</ul>
      )}
    </div>
  );
});
