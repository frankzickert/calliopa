import { $, component$, Slot, useContext, useContextProvider, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import type { DocumentDecorationProps } from "~/contract";
import { ViewBridgeContext, type ViewBarGroup } from "~/components/shell/view-bridge";

import type { Connection, RuntimeListing } from "../../lib/types";
import { SessionContext, type SessionState } from "./context";

/**
 * The document's connection (`BO_0289_019`): read once when the document is
 * shown, shared with the send control on every code block through the
 * context, and offered in the document's bar as the shell's decoration bar —
 * the runtime the document is connected to, chosen among the ones that run;
 * *Restart session*, which opens a fresh session on the same runtime with
 * its state gone; and *Interrupt* while something runs.
 *
 * The group is this extension's own, after the view's groups, and the write
 * to the decoration bar keeps every other extension's group: the bar is one
 * store per shell, so a provider that assigned the whole array would take
 * refinement's *Establish…* away.
 */
export const SessionProvider = component$<DocumentDecorationProps>(({ documentId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<SessionState>({
    documentId,
    loaded: false,
    reachable: true,
    runtime: null,
    runtimeName: "",
    runtimeState: "",
    session: null,
    running: "",
    runtimes: [],
    refusal: "",
  });
  useContextProvider(SessionContext, state);

  const read$ = $(async () => {
    const [connection, listing] = await Promise.all([
      fetch(`/api/x/code/connection?artifact=${encodeURIComponent(documentId)}`),
      fetch("/api/x/code/runtimes"),
    ]);
    state.loaded = true;
    if (connection.status === 404 || listing.status === 404) {
      state.reachable = false;
      return;
    }
    if (connection.ok) {
      const answer = (await connection.json()) as Connection;
      state.runtime = answer.runtime;
      state.runtimeName = answer.runtimeName ?? "";
      state.runtimeState = answer.runtimeState ?? "";
      state.session = answer.session;
      state.running = answer.running;
    }
    if (listing.ok) {
      const answer = (await listing.json()) as RuntimeListing;
      state.reachable = answer.reachable;
      state.runtimes = answer.runtimes;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the connection is the kernel's, read in the browser with the person's session
  useVisibleTask$(async ({ track }) => {
    track(() => documentId);
    state.documentId = documentId;
    await read$();
  });

  const connect$ = $(async (runtime: string) => {
    state.refusal = "";
    const answer = await fetch("/api/x/code/connection", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifact: documentId, runtime: runtime === "" ? null : runtime }),
    });
    if (!answer.ok) {
      state.refusal = ((await answer.json().catch(() => ({}))) as { error?: string }).error ?? "The runtime could not be connected.";
      return;
    }
    await read$();
  });

  const restart$ = $(async () => {
    state.refusal = "";
    const answer = await fetch("/api/x/code/restart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifact: documentId }),
    });
    if (!answer.ok) {
      state.refusal = ((await answer.json().catch(() => ({}))) as { error?: string }).error ?? "The session could not be restarted.";
    }
    await read$();
  });

  const interrupt$ = $(async () => {
    await fetch("/api/x/code/interrupt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifact: documentId }),
    });
    await read$();
  });

  useTask$(({ track }) => {
    const loaded = track(() => state.loaded);
    const reachable = track(() => state.reachable);
    const runtime = track(() => state.runtime);
    const running = track(() => state.running);
    const runtimes = track(() => state.runtimes);
    const others = bridge.decorationBar.groups.filter((group) => group.id !== "code");
    if (!loaded || !reachable) {
      bridge.decorationBar.groups = others;
      return;
    }
    const options = [
      { value: "", label: "No runtime" },
      ...runtimes.filter((record) => record.state === "running").map((record) => ({ value: record.id, label: record.name })),
    ];
    if (runtime !== null && !options.some((option) => option.value === runtime)) {
      options.push({ value: runtime, label: `${state.runtimeName || runtime} (${state.runtimeState || "gone"})` });
    }
    const group: ViewBarGroup = {
      id: "code",
      label: "Code",
      actions: [
        {
          kind: "choice",
          id: "code-runtime",
          label: "Runtime",
          value: runtime ?? "",
          options,
          run$: connect$,
        },
        {
          kind: "button",
          id: "code-restart",
          label: "Restart session",
          icon: "arrow-counter-clockwise",
          name: "Restart the document's session: state gone, files kept",
          disabled: runtime === null,
          run$: restart$,
        },
        ...(running !== ""
          ? [
              {
                kind: "button" as const,
                id: "code-interrupt",
                label: "Interrupt",
                icon: "x-circle" as const,
                name: "Interrupt what the document's session is running",
                run$: interrupt$,
              },
            ]
          : []),
      ],
    };
    bridge.decorationBar.groups = [...others, group];
  });

  return <Slot />;
});
