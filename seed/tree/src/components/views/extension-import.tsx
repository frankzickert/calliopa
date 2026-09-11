import { $, component$, useContext, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext, type InspectorFact } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import { describeImport, nextStep, type ImportRecord } from "~/lib/extension-import";

/**
 * A staged import of an extension: the tab the Extensions section opens once
 * the kernel has staged the archive, keyed by the proposal group so a second
 * press reveals it. It shows the kernel's summary — what the import adds or
 * changes, the members, the documents, the migrations that run when the
 * extension is served, the dependencies with their verdicts, every refusal —
 * and walks the steps: *Accept*, which lands on the kernel's own confirmation
 * page the way every extension group does, then *Switch on* for a new
 * extension (the state route: the range check and the gate) or *Serve now*
 * for an update (a promotion of head), followed here until the kernel serves
 * or the gate refuses. The shell reviews no code: the summary is the kernel's
 * and the acceptance is its page. BO_0224_011
 */

type Phase =
  | "loading"
  | "open"
  | "confirm"
  | "accepted"
  | "rejected"
  | "promoting"
  | "served"
  | "refused"
  | "gone";

interface State {
  phase: Phase;
  record: ImportRecord | null;
  detail: string;
  confirmUrl: string | null;
  busy: boolean;
}

export const ExtensionImportView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<State>({
    phase: "loading",
    record: null,
    detail: "",
    confirmUrl: null,
    busy: false,
  });
  const group = tab.itemId ?? "";

  const read$ = $(async (): Promise<ImportRecord | null> => {
    const response = await fetch(`/api/x/ui.shell/extensions/import/${encodeURIComponent(group)}`);
    if (!response.ok) {
      const refusal = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      state.phase = "gone";
      state.detail = refusal.message ?? refusal.error ?? `the kernel answered ${response.status}`;
      state.record = null;
      return null;
    }
    const record = (await response.json()) as ImportRecord;
    state.record = record;
    return record;
  });

  /** Reads the record and moves the phase with what the graph says. */
  const follow$ = $(async () => {
    const record = await read$();
    if (record === null) return;
    if (state.phase === "promoting") {
      const promotion = record.promotion;
      if (promotion === undefined || promotion.status === "running") return;
      if (promotion.status === "promoted") {
        state.phase = "served";
        state.detail = "";
      } else {
        state.phase = "refused";
        state.detail = promotion.detail ?? "the promotion was refused";
      }
      return;
    }
    if (record.state === "accepted" && (state.phase === "loading" || state.phase === "open" || state.phase === "confirm")) {
      state.phase = "accepted";
      state.confirmUrl = null;
      return;
    }
    if (record.state === "rejected") {
      state.phase = "rejected";
      return;
    }
    if (state.phase === "loading") state.phase = "open";
  });

  // The record on mount, then a poll every two seconds while a step is in
  // flight — the confirmation in another tab, the build after a press.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    void follow$();
    const timer = setInterval(() => {
      if (state.phase === "confirm" || state.phase === "promoting" || state.phase === "loading") void follow$();
    }, 2000);
    cleanup(() => clearInterval(timer));
  });

  const decide$ = $(async (verb: "accept" | "reject") => {
    const summary = state.record?.summary;
    if (summary === undefined) return;
    state.busy = true;
    state.detail = "";
    try {
      const response = await fetch(`/api/x/ui.shell/extensions/import/${encodeURIComponent(group)}/${verb}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: summary.id, version: summary.to }),
      });
      const answer = (await response.json()) as { status?: string; confirmUrl?: string; message?: string; error?: string };
      if (!response.ok) {
        state.detail = answer.message ?? answer.error ?? `the kernel answered ${response.status}`;
        return;
      }
      if (verb === "reject") {
        state.phase = "rejected";
        await read$();
        return;
      }
      if (answer.status === "pending" && answer.confirmUrl !== undefined) {
        state.confirmUrl = answer.confirmUrl;
        state.phase = "confirm";
        return;
      }
      state.phase = "accepted";
      await read$();
    } finally {
      state.busy = false;
    }
  });

  const serve$ = $(async () => {
    const summary = state.record?.summary;
    if (summary === undefined) return;
    state.busy = true;
    state.detail = "";
    try {
      const response =
        nextStep(summary) === "switch-on"
          ? await fetch(`/api/x/ui.shell/extensions/${encodeURIComponent(summary.id)}/state`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ active: true }),
            })
          : await fetch("/api/x/ui.shell/extensions/promote", { method: "POST" });
      const answer = (await response.json()) as { changed?: boolean; message?: string; error?: string };
      if (!response.ok) {
        state.detail = answer.message ?? answer.error ?? `the kernel answered ${response.status}`;
        return;
      }
      if (answer.changed === false) {
        // Already on: nothing to promote here.
        state.phase = "served";
        return;
      }
      state.phase = "promoting";
    } finally {
      state.busy = false;
    }
  });

  const openExtension$ = $(async () => {
    const id = state.record?.summary.id;
    if (id === undefined) return;
    await bridge.openTarget$({ kind: "ui.shell:extension", itemId: `ext:${id}`, title: id });
  });

  useTask$(({ track }) => {
    track(() => state.record);
    track(() => state.phase);
    const summary = state.record?.summary;
    const facts: InspectorFact[] =
      summary === undefined
        ? []
        : [
            { kind: "text", label: "Extension", value: summary.id },
            { kind: "text", label: "Version", value: summary.kind === "new" ? summary.to : `${summary.from ?? "?"} → ${summary.to}` },
            { kind: "text", label: "Proposal", value: state.record?.proposal ?? "" },
            { kind: "text", label: "State", value: state.phase },
          ];
    bridge.inspector.facts = facts;
    bridge.inspector.actions = [];
    bridge.inspector.text = summary === undefined ? state.detail || "Reading the import…" : null;
  });

  const record = state.record;
  const summary = record?.summary;
  const step = summary === undefined ? "serve" : nextStep(summary);
  return (
    <div class="view view--extension-import extension-import" data-view-body="extension-import" data-import-phase={state.phase}>
      {state.phase === "loading" && <p class="extension-status">Reading the import…</p>}
      {state.phase === "gone" && (
        <p class="extension-status" role="status" data-import-gone>
          {state.detail}
        </p>
      )}
      {summary !== undefined && (
        <>
          <h2 class="extension-import__title" data-import-extension={summary.id}>
            {summary.kind === "new" ? "Import" : "Update"} {summary.id} {summary.to}
          </h2>
          <ul class="extension-import__lines" data-import-summary>
            {describeImport(summary).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {state.phase === "open" && (
            <div class="extension-import__controls">
              <span class="extension-note">
                Staged as proposal {record?.proposal} by {record?.by}. Accepting establishes it on the kernel's own
                confirmation page.
              </span>
              <button type="button" class="extension-import__action" disabled={state.busy} data-import-accept onClick$={() => decide$("accept")}>
                Accept
              </button>
              <button type="button" class="extension-import__action" disabled={state.busy} data-import-reject onClick$={() => decide$("reject")}>
                Reject
              </button>
            </div>
          )}
          {state.phase === "confirm" && state.confirmUrl !== null && (
            <p class="extension-note" role="status" data-import-confirm={state.confirmUrl}>
              Establishing an extension needs the kernel's own confirmation:{" "}
              <a href={state.confirmUrl} target="_blank" rel="noreferrer">
                confirm the acceptance
              </a>
              . This tab moves on when the proposal is accepted.
            </p>
          )}
          {state.phase === "accepted" && (
            <div class="extension-import__controls">
              <span class="extension-note" role="status">
                {step === "switch-on"
                  ? `${summary.id} is established and switched off. Switch it on to build and serve it.`
                  : `${summary.id} ${summary.to} is established; head is past the served pin. Serve it now, or pin later from its page.`}
              </span>
              <button type="button" class="extension-import__action" disabled={state.busy} data-import-serve={step} onClick$={() => serve$()}>
                {step === "switch-on" ? "Switch on" : "Serve now"}
              </button>
              <button type="button" class="extension-import__action" onClick$={() => openExtension$()}>
                Open {summary.id}
              </button>
            </div>
          )}
          {state.phase === "promoting" && (
            <p class="extension-status" role="status" data-import-promoting>
              {step === "switch-on" ? "Switching on" : "Serving"}: the kernel builds and checks the tree before it serves it.
            </p>
          )}
          {state.phase === "served" && (
            <div class="extension-import__controls">
              <span class="extension-note" role="status" data-import-served={summary.id}>
                Serving {summary.id} {summary.to}. Reload to run the new shell.
              </span>
              <button type="button" class="extension-import__action" onClick$={() => openExtension$()}>
                Open {summary.id}
              </button>
            </div>
          )}
          {state.phase === "refused" && (
            <p class="extension-note" role="status" data-extension-note="refused" data-import-refused>
              Promotion refused: {state.detail}. The graph holds the extension; the served pin still carries the previous shape.
            </p>
          )}
          {state.phase === "rejected" && (
            <p class="extension-status" role="status" data-import-rejected>
              The import was rejected; nothing was established.
            </p>
          )}
          {state.detail !== "" && state.phase !== "refused" && state.phase !== "gone" && (
            <p class="extension-note" role="alert" data-extension-note="refusal">
              {state.detail}
            </p>
          )}
        </>
      )}
    </div>
  );
});
