import { $, component$, useContext, useStore, useTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";

import { inOrder, UNNAMED_ROLE, type RolesListing, type RoleView } from "../lib/roles";

/**
 * The Roles section (`BO_0299_012`, `BO_0309_015`): the roles, the built-ins
 * first, retired ones left out, each opening its own page, where the role is
 * defined — its fields, what it offers, its defaults — and never assigned
 * (`BO_0318`). A built-in's row unfolds to the documents carrying it, each
 * opening as itself (`BO_0308_Q11`), and carries the `+` its owner
 * contributes, opening the owner's form — *Add source* on *Source*
 * (`BO_0313_011`). The section's own `+` creates a role through this
 * extension's route and opens it.
 */

const EMPTY: RolesListing = { reachable: false, roles: [] };

type Carrying = { readonly id: string; readonly title: string };

export const RolesSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    listing: RolesListing;
    busy: boolean;
    refusal: string;
    reads: number;
    unfolded: Record<string, readonly Carrying[] | "reading" | "refused">;
  }>({
    listing: (data as RolesListing | null) ?? EMPTY,
    busy: false,
    refusal: "",
    reads: 0,
    unfolded: {},
  });

  useTask$(({ track }) => {
    const next = track(() => data) as RolesListing | null;
    if (next !== null && next !== undefined) state.listing = next;
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/doc-block-roles/roles").catch(() => null);
    if (response === null || !response.ok) return;
    state.listing = (await response.json()) as RolesListing;
    state.reads += 1;
  });

  const open$ = $((role: RoleView) =>
    bridge.openTarget$({ kind: "doc-block-roles:documentRole", itemId: role.id, title: role.name }),
  );

  const unfold$ = $(async (role: RoleView) => {
    if (state.unfolded[role.id] !== undefined) {
      const { [role.id]: _, ...rest } = state.unfolded;
      state.unfolded = rest;
      return;
    }
    state.unfolded = { ...state.unfolded, [role.id]: "reading" };
    const response = await fetch(`/api/x/doc-block-roles/roles/${encodeURIComponent(role.id)}/documents`).catch(() => null);
    const answer = (await response?.json().catch(() => null)) as { outcome?: string; result?: readonly Carrying[] } | null;
    state.unfolded = {
      ...state.unfolded,
      [role.id]: answer?.outcome === "success" && answer.result !== undefined ? answer.result : "refused",
    };
  });

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
      const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as {
        outcome: string;
        result?: RoleView;
        detail?: string;
      };
      if (answer.outcome !== "success" || answer.result === undefined) {
        state.refusal = answer.detail ?? `The role was not created: the server answered ${response.status}.`;
        return;
      }
      await open$(answer.result);
      await refresh$();
    } finally {
      state.busy = false;
    }
  });

  const listing = state.listing;
  const roles = inOrder(listing.roles).filter((role) => !role.retired);
  return (
    <>
      <div class="library-section-actions">
        <button
          type="button"
          class="library-action library-action--body library-action--icon"
          aria-label="New role"
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
            const unfolded = state.unfolded[role.id];
            return (
              <li key={role.id} data-builtin={role.builtin ? "true" : undefined}>
                <span class="roles-row">
                  {role.builtin && (
                    <button
                      type="button"
                      class="library-action library-action--icon"
                      aria-label={`${unfolded === undefined ? "Show" : "Hide"} the documents carrying ${role.name}`}
                      aria-expanded={unfolded === undefined ? "false" : "true"}
                      data-unfold-role={role.id}
                      onClick$={() => unfold$(role)}
                    >
                      <Icon name={unfolded === undefined ? "caret-right" : "caret-down"} />
                    </button>
                  )}
                  <button
                    type="button"
                    class="library-entry"
                    data-role-row={role.id}
                    data-current={current ? "true" : undefined}
                    aria-current={current ? "true" : undefined}
                    onClick$={() => open$(role)}
                  >
                    <span class="library-entry__label">{role.name}</span>
                    {role.builtin && <span class="roles-row__builtin">built in</span>}
                    {current && <span class="library-entry__marker" aria-hidden="true" />}
                  </button>
                  {role.create !== undefined && (
                    <button
                      type="button"
                      class="library-action library-action--icon"
                      aria-label={role.create.label}
                      data-role-create={role.id}
                      onClick$={() => {
                        const create = role.create;
                        if (create !== undefined)
                          void bridge.openTarget$({ kind: create.kind, itemId: "new", title: create.label });
                      }}
                    >
                      <Icon name="plus" />
                    </button>
                  )}
                </span>
                {unfolded !== undefined && (
                  <ul class="library-list roles-row__documents" data-carrying={role.id}>
                    {unfolded === "reading" ? (
                      <li class="library-empty">Reading…</li>
                    ) : unfolded === "refused" ? (
                      <li class="library-empty">The documents could not be read</li>
                    ) : unfolded.length === 0 ? (
                      <li class="library-empty">No document carries {role.name}</li>
                    ) : (
                      unfolded.map((document) => (
                        <li key={document.id}>
                          <button
                            type="button"
                            class="library-entry"
                            data-carrying-document={document.id}
                            onClick$={() =>
                              bridge.openTarget$({ kind: "documents:document", itemId: document.id, title: document.title })
                            }
                          >
                            <span class="library-entry__label">{document.title === "" ? "Untitled" : document.title}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
});
