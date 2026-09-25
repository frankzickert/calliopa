import { $, component$, useContext, useStore, useTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";
import { offeredBy, offeredRoles, type DocumentRoleView } from "~/extensions/doc-block-roles/lib/roles";

import { NO_ROLE, roleChoiceValue, type KeywordsListing, type KeywordsSettings } from "../lib/keywords";
import "./keywords.css";

/**
 * The Keywords section (`BO_0301_012`): three choices over the role
 * catalogue — *Keyword role* over the document roles, *Definition role* over
 * the block roles the keyword role offers and over the document roles for a
 * focused-work child, *Alias role* over the block roles the keyword role
 * offers, each with *None* first — kept as the extension's settings, and
 * below them every document carrying the keyword role by title, each
 * opening as the document it is. The kernel refuses a choice from anyone but
 * the owner, and the refusal is said here.
 */

const EMPTY: KeywordsListing = { reachable: false, settings: { keywordRole: null, definitionRole: null, aliasRole: null }, roles: [], keywords: [] };

export const KeywordsSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ listing: KeywordsListing; busy: boolean; notice: string; reads: number }>({
    listing: (data as KeywordsListing | null) ?? EMPTY,
    busy: false,
    notice: "",
    reads: 0,
  });

  useTask$(({ track }) => {
    const next = track(() => data) as KeywordsListing | null;
    if (next !== null && next !== undefined) state.listing = next;
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/keywords/keywords").catch(() => null);
    if (response === null || !response.ok) return;
    state.listing = (await response.json()) as KeywordsListing;
    state.reads += 1;
  });

  const choose$ = $(async (field: keyof KeywordsSettings, value: string) => {
    if (state.busy) return;
    state.busy = true;
    state.notice = "";
    try {
      const response = await fetch("/api/x/keywords/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: value === NO_ROLE ? null : value }),
      });
      if (!response.ok) {
        const answer = (await response.json().catch(() => ({}))) as { detail?: string; error?: string };
        // A bare 503 is the kernel while the shell restarts for a pin: the
        // choice is kept and the words say to try again. Found in the walk,
        // 2026-09-25, when a choice landed in another session's pin.
        state.notice =
          answer.detail ??
          answer.error ??
          (response.status === 503 ? "Calliopa is restarting; choose again in a moment." : `The choice was not saved: the server answered ${response.status}.`);
        return;
      }
      state.listing = { ...state.listing, settings: (await response.json()) as KeywordsSettings };
      await refresh$();
    } finally {
      state.busy = false;
    }
  });

  const open$ = $((keyword: { id: string; title: string }) =>
    bridge.openTarget$({ kind: "documents:document", itemId: keyword.id, title: keyword.title }),
  );

  const listing = state.listing;
  const settings = listing.settings;
  const documentRoles = offeredRoles(listing.roles);
  const keywordRole: DocumentRoleView | null = listing.roles.find((role) => role.id === settings.keywordRole) ?? null;
  const blockRoles = keywordRole === null ? [] : offeredBy(keywordRole);
  const definitionValue = roleChoiceValue(settings.definitionRole);

  return (
    <>
      {listing.reachable && (
        <div class="keywords-settings" data-keywords-settings>
          <label class="keywords-settings__field">
            <span>Keyword role</span>
            <select data-keyword-role disabled={state.busy} onChange$={(_, element) => choose$("keywordRole", element.value)}>
              <option value={NO_ROLE} selected={settings.keywordRole === null}>
                None
              </option>
              {documentRoles.map((role) => (
                <option key={role.id} value={role.id} selected={role.id === settings.keywordRole}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label class="keywords-settings__field">
            <span>Definition role</span>
            <select data-definition-role disabled={state.busy || keywordRole === null} onChange$={(_, element) => choose$("definitionRole", element.value)}>
              <option value={NO_ROLE} selected={settings.definitionRole === null}>
                None
              </option>
              {blockRoles.length > 0 && (
                <optgroup label={`Block roles of ${keywordRole?.name ?? ""}`}>
                  {blockRoles.map((role) => (
                    <option key={role.id} value={`block:${role.id}`} selected={`block:${role.id}` === definitionValue}>
                      {role.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Document roles, for a focused-work child">
                {documentRoles.map((role) => (
                  <option key={role.id} value={`document:${role.id}`} selected={`document:${role.id}` === definitionValue}>
                    {role.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label class="keywords-settings__field">
            <span>Alias role</span>
            <select data-alias-role disabled={state.busy || keywordRole === null} onChange$={(_, element) => choose$("aliasRole", element.value)}>
              <option value={NO_ROLE} selected={settings.aliasRole === null}>
                None
              </option>
              {blockRoles.map((role) => (
                <option key={role.id} value={role.id} selected={role.id === settings.aliasRole}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          {state.notice !== "" && (
            <p class="library-refusal" role="alert" data-keywords-notice>
              {state.notice}
            </p>
          )}
        </div>
      )}
      {!listing.reachable ? (
        <p class="library-empty" data-keywords-empty>
          The keywords could not be read
        </p>
      ) : settings.keywordRole === null ? (
        <p class="library-empty" data-keywords-empty>
          Choose the document role that marks a keyword
        </p>
      ) : listing.keywords.length === 0 ? (
        <p class="library-empty" data-keywords-empty>
          No keywords yet
        </p>
      ) : (
        <ul class="library-list" key={state.reads} data-keywords>
          {listing.keywords.map((keyword) => {
            const current = activeItemId === keyword.id;
            return (
              <li key={keyword.id}>
                <button
                  type="button"
                  class="library-entry"
                  data-keyword-row={keyword.id}
                  data-current={current ? "true" : undefined}
                  aria-current={current ? "true" : undefined}
                  onClick$={() => open$(keyword)}
                >
                  <span class="library-entry__label">{keyword.title === "" ? "Untitled" : keyword.title}</span>
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
