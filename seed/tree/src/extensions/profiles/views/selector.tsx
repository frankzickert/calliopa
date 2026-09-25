import { $, component$, Slot, useContext, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import type { DocumentDecorationProps } from "~/contract";
import { ViewBridgeContext, type ViewBarGroup } from "~/components/shell/view-bridge";
import type { ProfileSelection, ProfileSummary } from "~/extensions/documents/lib/profile";

import type { ProfilesListing } from "../contributions.server";

/**
 * The profile selector in the document's bar (`BO_0298_016`): a dropdown
 * named *Profile* listing *No profile* first and every profile by title,
 * showing the document's selection and writing a choice at once as the
 * person's own act through this extension's route. It stands on every
 * document tab, a profile's own included, where it defaults to *No profile*
 * (`BO_0298_Q9`). A selection naming a profile that is gone is shown as such,
 * with *No profile* offered. The group is this extension's own and the write
 * keeps every other extension's group, as the manuscripts extension's does.
 */

/** The choice's value for *No profile*. */
export const NO_PROFILE = "";

/** The choice's value for a selection the graph no longer holds as a profile. */
export const GONE_PROFILE = "gone";

export const ProfileSelector = component$<DocumentDecorationProps>(({ documentId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ loaded: boolean; reachable: boolean; profiles: ProfileSummary[]; selection: ProfileSelection; busy: boolean }>({
    loaded: false,
    reachable: false,
    profiles: [],
    selection: { profile: null, gone: null },
    busy: false,
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the selection and the profiles are read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    const id = track(() => documentId);
    const [listing, selection] = await Promise.all([
      fetch("/api/library/profiles/profiles").catch(() => null),
      fetch(`/api/x/profiles/documents/${encodeURIComponent(id)}/selection`).catch(() => null),
    ]);
    if (listing !== null && listing.ok) {
      const body = (await listing.json().catch(() => null)) as ProfilesListing | null;
      state.reachable = body?.reachable === true;
      state.profiles = [...(body?.profiles ?? [])];
    }
    if (selection !== null && selection.ok) {
      const answer = (await selection.json()) as { outcome: string; result?: ProfileSelection };
      if (answer.outcome === "success" && answer.result !== undefined) state.selection = answer.result;
    }
    state.loaded = true;
  });

  const choose$ = $(async (value: string) => {
    if (state.busy || value === GONE_PROFILE) return;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/profiles/documents/${encodeURIComponent(documentId)}/selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: value === NO_PROFILE ? null : value }),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as { outcome: string; result?: ProfileSelection; detail?: string };
      if (response.ok && answer.outcome === "success" && answer.result !== undefined) {
        state.selection = answer.result;
        return;
      }
      await bridge.raiseMessage$({
        headline: "The profile was not attached",
        body: answer.detail ?? `The server answered ${response.status}.`,
        answers: [{ id: "ok", label: "OK" }],
      });
    } finally {
      state.busy = false;
    }
  });

  useTask$(({ track }) => {
    const loaded = track(() => state.loaded);
    const reachable = track(() => state.reachable);
    const profiles = track(() => state.profiles);
    const selection = track(() => state.selection);
    const others = bridge.decorationBar.groups.filter((group) => group.id !== "profile");
    // No selector while the profiles cannot be read: a dropdown offering
    // nothing but No profile would say the instance has none.
    if (!loaded || !reachable) {
      bridge.decorationBar.groups = others;
      return;
    }
    const gone = selection.gone !== null;
    const group: ViewBarGroup = {
      id: "profile",
      label: "Profile",
      actions: [
        {
          kind: "choice",
          id: "profile-selection",
          label: "Profile",
          value: gone ? GONE_PROFILE : (selection.profile?.id ?? NO_PROFILE),
          options: [
            { value: NO_PROFILE, label: "No profile" },
            ...(gone ? [{ value: GONE_PROFILE, label: "The selected profile is gone" }] : []),
            ...profiles.map((profile) => ({ value: profile.id, label: profile.title })),
          ],
          run$: choose$,
        },
      ],
    };
    bridge.decorationBar.groups = [...others, group];
  });

  return <Slot />;
});
