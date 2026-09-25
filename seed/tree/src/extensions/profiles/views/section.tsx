import { $, component$, useContext, useStore, useTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";
import { isUnnamed, UNNAMED_PROFILE } from "~/extensions/documents/lib/naming";

import type { ProfilesListing } from "../contributions.server";

/**
 * The Profiles section (`BO_0298_014`): the instance's profiles by title,
 * each opening in the document tab it is, and the section's own `+`, which
 * creates one through this extension's route and opens it — the
 * Investigations section's idiom, since a section's create control opens a
 * kind of the section's own extension and a profile is `documents`' kind.
 */

const EMPTY: ProfilesListing = { reachable: false, profiles: [] };

export const ProfilesSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ listing: ProfilesListing; busy: boolean; refusal: string; reads: number }>({
    listing: (data as ProfilesListing | null) ?? EMPTY,
    busy: false,
    refusal: "",
    reads: 0,
  });

  useTask$(({ track }) => {
    const next = track(() => data) as ProfilesListing | null;
    if (next !== null && next !== undefined) state.listing = next;
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/profiles/profiles").catch(() => null);
    if (response === null || !response.ok) return;
    state.listing = (await response.json()) as ProfilesListing;
    state.reads += 1;
  });

  const open$ = $((id: string, title: string) => bridge.openTarget$({ kind: "documents:document", itemId: id, title }));

  const create$ = $(async () => {
    if (state.busy) return;
    state.busy = true;
    state.refusal = "";
    try {
      const response = await fetch("/api/x/profiles/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: UNNAMED_PROFILE }),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as { outcome: string; result?: { documentId: string }; detail?: string };
      if (answer.outcome !== "success" || answer.result === undefined) {
        state.refusal = answer.detail ?? `The profile was not created: the server answered ${response.status}.`;
        return;
      }
      await open$(answer.result.documentId, UNNAMED_PROFILE);
      await refresh$();
    } finally {
      state.busy = false;
    }
  });

  const listing = state.listing;
  return (
    <>
      <div class="library-section-actions">
        <button
          type="button"
          class="library-action library-action--body library-action--icon"
          aria-label="New profile"
          disabled={state.busy}
          data-new-profile
          onClick$={create$}
        >
          <Icon name="plus" />
        </button>
      </div>
      {state.refusal !== "" && (
        <p class="library-refusal" role="alert" data-profiles-notice>
          {state.refusal}
        </p>
      )}
      {!listing.reachable ? (
        <p class="library-empty" data-profiles-empty>
          The profiles could not be read
        </p>
      ) : listing.profiles.length === 0 ? (
        <p class="library-empty" data-profiles-empty>
          No profiles yet
        </p>
      ) : (
        <ul class="library-list" key={state.reads} data-profiles>
          {listing.profiles.map((profile) => {
            const current = activeItemId === profile.id;
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  class="library-entry"
                  data-profile-row={profile.id}
                  data-current={current ? "true" : undefined}
                  aria-current={current ? "true" : undefined}
                  onClick$={() => open$(profile.id, profile.title)}
                >
                  <span class="library-entry__label" data-unnamed={isUnnamed(profile.title) ? "true" : "false"}>
                    {profile.title}
                  </span>
                  {current && <span class="library-entry__marker" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
});
