import { $, component$, useContext, useStore, useTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";

import { OUTCOME_WORDS, type ManuscriptView } from "../lib/manuscript";
import type { ManuscriptsListing } from "../contributions.server";
import "./manuscripts.css";

/**
 * The Manuscripts section (`BO_0293_022`): every kept manuscript, newest
 * first, each the document's title, its venue, when and the outcome, opening
 * in its own tab. A manuscript is made from the document's bar; this is where
 * what was made stays findable.
 */
const EMPTY: ManuscriptsListing = { reachable: false, manuscripts: [] };

export const ManuscriptsSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ listing: ManuscriptsListing }>({ listing: (data as ManuscriptsListing | null) ?? EMPTY });

  useTask$(({ track }) => {
    const next = track(() => data) as ManuscriptsListing | null;
    if (next !== null && next !== undefined) state.listing = next;
  });

  const open$ = $((manuscript: ManuscriptView) =>
    bridge.openTarget$({ kind: "manuscripts:manuscript", itemId: manuscript.manuscriptId, title: manuscript.title === "" ? "Manuscript" : manuscript.title }),
  );

  if (!state.listing.reachable) return <p class="library-empty">The manuscripts could not be read.</p>;
  if (state.listing.manuscripts.length === 0) return <p class="library-empty">No manuscripts yet</p>;
  return (
    <ul class="library-list" data-manuscripts>
      {state.listing.manuscripts.map((manuscript) => (
        <li key={manuscript.manuscriptId}>
          <button
            type="button"
            class="library-entry"
            data-manuscript={manuscript.manuscriptId}
            aria-current={activeItemId === manuscript.manuscriptId ? "true" : undefined}
            onClick$={() => open$(manuscript)}
          >
            <span class="library-entry__title">{manuscript.title === "" ? "Untitled document" : manuscript.title}</span>
            <span class="manuscripts-row__meta">
              {manuscript.venue} · {manuscript.made.slice(0, 16).replace("T", " ")} · {OUTCOME_WORDS[manuscript.outcome]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
});
