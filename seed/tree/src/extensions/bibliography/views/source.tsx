import { $, component$, Slot, useContext, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { DocumentDecorationProps, DocumentPlaceProps } from "~/contract";
import type { CitingDocument } from "~/extensions/documents/server/cited-by";
import { describeOutcome, readOutcome } from "~/extensions/documents/views/documents-client";
import { EditorSurfaceContext } from "~/extensions/documents/views/editor-surface";

import type { Capability } from "~/lib/capabilities";

import type { FetchAnswer } from "../server/fetch";
import type { WorkView } from "../server/works";
import { ReferenceList } from "./references";
import "./bibliography.css";

/**
 * What a source document carries beside any document's (`BO_0313_021`): a
 * source opens as the document it is, its fields in the inspector where
 * every role's are, its body the person's notes. Its bar holds *Fill from
 * identifier*, which fetches a record for a DOI, an ISBN, an arXiv id or a
 * link and writes it over the title and the fields the record holds, keeping
 * the rest; and *Cited by* stands at its end. A document that is no source
 * gets neither.
 */

const GROUP = "source";

interface Candidates {
  readonly url: string;
  readonly session: string;
  readonly items: Readonly<Record<string, string>>;
}

/** The source a document is, or null when it is none. */
async function sourceOf(documentId: string): Promise<WorkView | null> {
  const response = await fetch(`/api/x/bibliography/works/${encodeURIComponent(documentId)}`).catch(() => null);
  if (response === null || !response.ok) return null;
  const answer = (await response.json().catch(() => null)) as { outcome?: string; result?: WorkView } | null;
  return answer?.outcome === "success" && answer.result !== undefined ? answer.result : null;
}

export const SourceProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const bridge = useContext(ViewBridgeContext);
  const surface = useContext(EditorSurfaceContext);
  const state = useStore<{
    source: WorkView | null;
    open: boolean;
    input: string;
    busy: boolean;
    notice: string;
    candidates: Candidates | null;
    /** Why a fetch cannot be made here and now, or null when it can. BO_0319_043 */
    unready: string | null;
  }>({ source: null, open: false, input: "", busy: false, notice: "", candidates: null, unready: null });

  // Fetching a record needs the network; its capability says whether it is
  // there, read again whenever the browser says the network came or went.
  // BO_0319_043
  // eslint-disable-next-line qwik/no-use-visible-task -- the network is the browser's to report
  useVisibleTask$(({ cleanup }) => {
    const read = async () => {
      const response = await fetch("/api/capabilities").catch(() => null);
      const answer = response?.ok ? ((await response.json()) as { capabilities?: readonly Capability[] }) : null;
      const capability = answer?.capabilities?.find((candidate) => candidate.id === "fetch:record");
      state.unready = capability === undefined || capability.state === "ready" ? null : capability.reason;
    };
    void read();
    // A page without a window — a suite's render — has no network to follow.
    if (typeof window === "undefined") return;
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    cleanup(() => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    });
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    track(() => surface.loaded);
    state.source = await sourceOf(id);
  });

  const toggle$ = $(() => {
    state.open = !state.open;
    state.notice = "";
    state.candidates = null;
  });

  // The bar is one store per shell, and other extensions write their own
  // groups to it (BO_0289_019), so this provider replaces its group alone.
  useTask$(({ track, cleanup }) => {
    const source = track(() => state.source);
    const unready = track(() => state.unready);
    const others = bridge.decorationBar.groups.filter((group) => group.id !== GROUP);
    bridge.decorationBar.groups =
      source === null
        ? others
        : [
            ...others,
            {
              id: GROUP,
              label: "Source",
              actions: [
                {
                  kind: "button",
                  id: "fill",
                  label: "Fill from identifier",
                  icon: "download-simple",
                  ...(unready === null ? {} : { disabled: true, name: `Fill from identifier — ${unready}` }),
                  run$: toggle$,
                },
              ],
            },
          ];
    cleanup(() => {
      bridge.decorationBar.groups = bridge.decorationBar.groups.filter((group) => group.id !== GROUP);
    });
  });

  const fill$ = $(async (body: Record<string, unknown>) => {
    const source = state.source;
    if (source === null) return;
    state.busy = true;
    state.notice = "";
    try {
      const response = await fetch("/api/x/bibliography/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused", detail: `the server answered ${response.status}` }))) as FetchAnswer;
      if (answer.outcome === "candidates") {
        state.candidates = { url: answer.url, session: answer.session, items: answer.items };
        return;
      }
      if (answer.outcome !== "record") {
        state.notice = answer.detail;
        return;
      }
      const written = await readOutcome<{ revisionId: string }>(
        await fetch("/api/x/bibliography/commands", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: "fillWork", workId: source.workId, baseRevisionId: source.revisionId, record: answer.record }),
        }),
      );
      if (written.outcome !== "success") {
        state.notice = describeOutcome(written);
        return;
      }
      state.open = false;
      state.input = "";
      state.candidates = null;
      await surface.reload$();
      await bridge.targetChanged$();
    } catch {
      state.notice = "The record could not be fetched: the server did not answer.";
    } finally {
      state.busy = false;
    }
  });

  return (
    <>
      {state.source !== null && state.open && (
        <form
          class="bib-fill"
          data-source-fill
          preventdefault:submit
          onSubmit$={() => {
            const input = state.input.trim();
            if (input === "") state.notice = "Paste a DOI, an ISBN, an arXiv id or a link.";
            else void fill$({ input });
          }}
        >
          <label class="bib-work__field bib-work__field--wide">
            <span>DOI, ISBN, arXiv id or link</span>
            <input
              type="text"
              autocomplete="off"
              value={state.input}
              disabled={state.busy}
              onInput$={(_, element) => {
                state.input = element.value;
              }}
            />
          </label>
          <button type="submit" class="bib-button bib-button--primary" disabled={state.busy}>
            {state.busy ? "Fetching…" : "Fill"}
          </button>
          <button type="button" class="bib-button" disabled={state.busy} onClick$={toggle$}>
            Cancel
          </button>
          {state.candidates !== null && (
            <ul class="bib-candidates">
              {Object.entries(state.candidates.items).map(([key, title]) => (
                <li key={key}>
                  <button
                    type="button"
                    disabled={state.busy}
                    onClick$={() => {
                      const candidates = state.candidates;
                      if (candidates !== null) void fill$({ selection: { url: candidates.url, session: candidates.session, items: { [key]: title } } });
                    }}
                  >
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state.notice !== "" && (
            <p class="bib-work__notice" role="alert">
              {state.notice}
            </p>
          )}
        </form>
      )}
      <Slot />
    </>
  );
});

/**
 * *Cited by* on a source document (`BO_0291_023`, an `end` place since
 * `BO_0313_021`): the documents citing it, each with the words of the blocks
 * that do, a document opened on a press. Nothing on a document that is no
 * source.
 */
export const CitedBy = component$<DocumentPlaceProps>(({ documentId, dataRevision }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ source: boolean; citing: readonly CitingDocument[] | null }>({ source: false, citing: null });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    track(() => dataRevision);
    if (documentId === "") return;
    const response = await fetch(`/api/x/bibliography/works/${encodeURIComponent(documentId)}/cited-by`).catch(() => null);
    if (response === null || !response.ok) {
      state.source = false;
      return;
    }
    const answer = await readOutcome<readonly CitingDocument[]>(response);
    state.source = answer.outcome === "success";
    state.citing = answer.outcome === "success" ? answer.result : null;
  });

  if (!state.source) return null;
  return (
    <section class="bib-cited-by" data-cited-by aria-label="Cited by">
      <h3 class="bib-cited-by__heading">Cited by</h3>
      {state.citing === null || state.citing.length === 0 ? (
        <p class="bib-work__fetched">No document cites this source.</p>
      ) : (
        <ul class="bib-cited-by__list">
          {state.citing.map((document) => (
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
  );
});

/** A document's end: its reference list, then — on a source — *Cited by*. */
export const SourceEnd = component$<DocumentPlaceProps>(({ documentId, dataRevision }) => (
  <>
    <ReferenceList documentId={documentId} dataRevision={dataRevision} />
    <CitedBy documentId={documentId} dataRevision={dataRevision} />
  </>
));
