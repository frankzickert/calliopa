import {
  $,
  component$,
  useContext,
  useStore,
  useTask$,
} from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";

import {
  offeredRoles,
  UNNAMED_ROLE,
  type DocumentRoleView,
  type RolesListing,
} from "../lib/roles";

/**
 * The Roles section (`BO_0299_012`): the instance's document roles by name,
 * retired ones left out, each opening its own page, and the section's own
 * `+`, which creates one through this extension's route and opens it — the
 * Profiles section's idiom.
 */

const EMPTY: RolesListing = { reachable: false, roles: [] };

export const RolesSection = component$<SectionProps>(
  ({ data, activeItemId }) => {
    const bridge = useContext(ViewBridgeContext);
    const state = useStore<{
      listing: RolesListing;
      busy: boolean;
      refusal: string;
      reads: number;
    }>({
      listing: (data as RolesListing | null) ?? EMPTY,
      busy: false,
      refusal: "",
      reads: 0,
    });

    useTask$(({ track }) => {
      const next = track(() => data) as RolesListing | null;
      if (next !== null && next !== undefined) state.listing = next;
    });

    const refresh$ = $(async () => {
      const response = await fetch("/api/library/doc-block-roles/roles").catch(
        () => null,
      );
      if (response === null || !response.ok) return;
      state.listing = (await response.json()) as RolesListing;
      state.reads += 1;
    });

    const open$ = $((role: DocumentRoleView) =>
      bridge.openTarget$({
        kind: "doc-block-roles:documentRole",
        itemId: role.id,
        title: role.name,
      }),
    );

    const create$ = $(async () => {
      if (state.busy) return;
      state.busy = true;
      state.refusal = "";
      try {
        const response = await fetch("/api/x/doc-block-roles/roles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: UNNAMED_ROLE }),
        });
        const answer = (await response
          .json()
          .catch(() => ({ outcome: "refused" }))) as {
          outcome: string;
          result?: DocumentRoleView;
          detail?: string;
        };
        if (answer.outcome !== "success" || answer.result === undefined) {
          state.refusal =
            answer.detail ??
            `The role was not created: the server answered ${response.status}.`;
          return;
        }
        await open$(answer.result);
        await refresh$();
      } finally {
        state.busy = false;
      }
    });

    const listing = state.listing;
    const roles = offeredRoles(listing.roles);
    return (
      <>
        <div class="library-section-actions">
          <button
            type="button"
            class="library-action library-action--body library-action--icon"
            aria-label="New document role"
            disabled={state.busy}
            data-new-role
            onClick$={create$}
          >
            <Icon name="plus" />
          </button>
        </div>
        {state.refusal !== "" && (
          <p class="library-refusal" role="alert" data-roles-notice>
            {state.refusal}
          </p>
        )}
        {!listing.reachable ? (
          <p class="library-empty" data-roles-empty>
            The roles could not be read
          </p>
        ) : roles.length === 0 ? (
          <p class="library-empty" data-roles-empty>
            No roles yet
          </p>
        ) : (
          <ul class="library-list" key={state.reads} data-roles>
            {roles.map((role) => {
              const current = activeItemId === role.id;
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    class="library-entry"
                    data-role-row={role.id}
                    data-current={current ? "true" : undefined}
                    aria-current={current ? "true" : undefined}
                    onClick$={() => open$(role)}
                  >
                    <span class="library-entry__label">{role.name}</span>
                    {current && (
                      <span class="library-entry__marker" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  },
);
