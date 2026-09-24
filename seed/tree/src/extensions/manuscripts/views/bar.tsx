import { $, component$, Slot, useContext, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import type { DocumentDecorationProps } from "~/contract";
import { ViewBridgeContext, type ViewBarGroup } from "~/components/shell/view-bridge";

import type { Venue } from "../lib/manuscript";

/**
 * *Make manuscript* in the document's bar (`BO_0293_022`): the venue to make
 * it for — the document's own when it names one, else the generic article —
 * chosen among the venues the typesetting service carries, and the press
 * that makes and keeps one and opens it in its own tab. A refusal — the
 * service down, the document unreadable — is said as a message in the route's
 * words. The group is this extension's own and the write keeps every other
 * extension's group, as the code extension's does.
 */
export const ManuscriptProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ loaded: boolean; reachable: boolean; venues: Venue[]; venue: string; busy: boolean }>({
    loaded: false,
    reachable: false,
    venues: [],
    venue: "",
    busy: false,
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the venues are the service's, read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    track(() => documentId);
    const answer = await fetch("/api/x/manuscripts/venues").catch(() => null);
    state.loaded = true;
    if (answer === null || !answer.ok) return;
    const body = (await answer.json()) as { reachable?: boolean; venues?: Venue[] };
    state.reachable = body.reachable === true;
    state.venues = body.venues ?? [];
  });

  const choose$ = $((venue: string) => {
    state.venue = venue;
  });

  const make$ = $(async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      const answer = await fetch("/api/x/manuscripts/make", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: documentId, ...(state.venue === "" ? {} : { venue: state.venue }) }),
      });
      const body = (await answer.json().catch(() => ({}))) as {
        outcome?: string;
        result?: { manuscriptId?: string };
        failures?: readonly { detail?: string }[];
        detail?: string;
        error?: string;
      };
      const id = body.result?.manuscriptId;
      if (answer.ok && body.outcome === "success" && id !== undefined) {
        await bridge.openTarget$({ kind: "manuscripts:manuscript", itemId: id, title: "Manuscript" });
        return;
      }
      await bridge.raiseMessage$({
        headline: "The manuscript was not made",
        body: body.failures?.[0]?.detail ?? body.detail ?? body.error ?? `The server answered ${answer.status}.`,
        answers: [{ id: "ok", label: "OK" }],
      });
    } finally {
      state.busy = false;
    }
  });

  useTask$(({ track }) => {
    const loaded = track(() => state.loaded);
    const reachable = track(() => state.reachable);
    const venues = track(() => state.venues);
    const venue = track(() => state.venue);
    const busy = track(() => state.busy);
    const others = bridge.decorationBar.groups.filter((group) => group.id !== "manuscripts");
    if (!loaded || !reachable) {
      bridge.decorationBar.groups = others;
      return;
    }
    const group: ViewBarGroup = {
      id: "manuscripts",
      label: "Manuscript",
      actions: [
        {
          kind: "choice",
          id: "manuscript-venue",
          label: "Venue",
          value: venue,
          options: [{ value: "", label: "The document's venue" }, ...venues.map((entry) => ({ value: entry.id, label: entry.name }))],
          run$: choose$,
        },
        {
          kind: "button",
          id: "manuscript-make",
          label: busy ? "Making the manuscript…" : "Make manuscript",
          icon: "files",
          name: "Make a manuscript of this document — LaTeX, its references and the PDF — and keep it",
          disabled: busy,
          run$: make$,
        },
      ],
    };
    bridge.decorationBar.groups = [...others, group];
  });

  return <Slot />;
});
