import { $, component$, useContext, useSignal, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import type { ItemAtChannel, ItemView as Item } from "../lib/work";

/**
 * The item tab: its facts, its exports with a replace control, its body
 * document opened in the editor for prose, and its own words — label, alt
 * text, transcript, disclosure. PU_0002_006
 */

const refusalOf = (body: unknown): string => {
  const failures = (body as { failures?: { detail: string }[] } | null)?.failures;
  return failures === undefined ? "It did not happen." : failures.map((failure) => failure.detail).join(" ");
};

const mib = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MiB` : `${Math.round(bytes / 1024)} KiB`);

export const ItemView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const missing = useSignal(false);
  const state = useStore<{ item: Item | null; notice: string | null; busy: boolean; reads: number; label: string; alt: string; transcript: string; at: ItemAtChannel[]; running: Record<string, string>; steps: Record<string, string> }>({
    item: null,
    notice: null,
    busy: false,
    reads: 0,
    label: "",
    alt: "",
    transcript: "",
    at: [],
    // The process each channel's act runs as, by channel, and its last step. PU_0009_002
    running: {},
    steps: {},
  });
  const replacing = useSignal<string>("");
  const fileInput = useSignal<HTMLInputElement>();

  const read$ = $(async (itemId: string) => {
    const response = await fetch(`/api/x/publishing/items/${itemId}`);
    const body = (await response.json()) as { outcome: "success"; result: Item } | { outcome: string };
    if (body.outcome !== "success") {
      missing.value = true;
      return;
    }
    state.item = (body as { result: Item }).result;
    state.label = state.item.label;
    state.alt = state.item.alt;
    state.transcript = state.item.transcript;
    // What this item is at every channel that takes items of its class. PU_0004_004
    const at = await fetch(`/api/x/publishing/items/${itemId}/at`);
    const atBody = (await at.json()) as { outcome: "success"; result: ItemAtChannel[] } | { outcome: string };
    if (atBody.outcome === "success") state.at = (atBody as { result: ItemAtChannel[] }).result;
    // Counted once the rows are in, so the inspector draws them with the facts.
    state.reads += 1;
  });

  useVisibleTask$(async ({ track }) => {
    const itemId = track(() => tab.itemId);
    if (itemId === null) return;
    await read$(itemId);
  });

  const send$ = $(async (path: string, method: string, body?: unknown, raw?: { file: File; query: string }) => {
    const itemId = tab.itemId;
    if (itemId === null || state.busy) return false;
    state.notice = null;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/publishing/items/${itemId}${path}${raw?.query ?? ""}`, {
        method,
        headers: raw === undefined ? { "content-type": "application/json" } : { "content-type": raw.file.type || "application/octet-stream", "x-filename": encodeURIComponent(raw.file.name) },
        ...(raw !== undefined ? { body: raw.file } : body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const outcome = (await response.json()) as { outcome: "success"; result: unknown } | { outcome: string };
      if (outcome.outcome !== "success") {
        state.notice = refusalOf(outcome);
        return false;
      }
      await read$(itemId);
      return outcome as { outcome: "success"; result: unknown };
    } finally {
      state.busy = false;
    }
  });

  const revise$ = $(async (values: { label?: string; alt?: string | null; transcript?: string | null; synthetic?: boolean }) => send$("", "PUT", values));

  const rereadAt$ = $(async () => {
    const response = await fetch(`/api/x/publishing/items/${tab.itemId}/at`);
    const body = (await response.json()) as { outcome: "success"; result: ItemAtChannel[] } | { outcome: string };
    if (body.outcome === "success") state.at = (body as { result: ItemAtChannel[] }).result;
  });

  // The act runs as a process the tab follows. PU_0009_002
  const follow$ = $(async (channelId: string, processId: string) => {
    state.running = { ...state.running, [channelId]: processId };
    state.steps = { ...state.steps, [channelId]: "starting" };
    for (let tick = 0; tick < 3600; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(`/api/processes/${processId}`);
      if (!response.ok) break;
      const process = (await response.json()) as { state: string; step: string | null; error: string | null };
      state.steps = { ...state.steps, [channelId]: process.step ?? "" };
      if (process.state === "completed" || process.state === "failed" || process.state === "cancelled") {
        state.notice = process.state === "failed" ? (process.error ?? "It did not land.") : null;
        break;
      }
    }
    const { [channelId]: _ended, ...rest } = state.running;
    state.running = rest;
    await rereadAt$();
  });

  const act$ = $(async (channelId: string, act: "publish" | "retire") => {
    const done = await send$(`/at/${channelId}/act`, "POST", { act, workspaceId: bridge.workspaceId });
    if (done === false) return;
    // A publish the projection refuses is answered, not logged: say each rule.
    const answer = done.result as { released?: boolean; refusals?: { detail: string }[]; processId?: string } | null;
    if (answer !== null && answer.released === false) {
      state.notice = answer.refusals?.map((refusal) => refusal.detail).join(" ") || "It did not land.";
      return;
    }
    if (answer !== null && typeof answer.processId === "string") await follow$(channelId, answer.processId);
  });

  const openDocument$ = $(() => {
    const item = state.item;
    if (item === null || item.documentId === null) return;
    return bridge.openTarget$({ kind: "documents:document", itemId: item.documentId, title: item.label });
  });

  const remove$ = $(async () => {
    const item = state.item;
    if (item === null) return;
    const done = await send$("", "DELETE", { baseRevisionId: item.revisionId });
    if (done !== false) missing.value = true;
  });

  useTask$(({ track }) => {
    const item = track(() => state.item);
    track(() => state.reads);
    track(() => state.at);
    track(() => state.running);
    track(() => state.steps);
    if (item === null) return;
    bridge.inspector.facts = [
      { kind: "text" as const, label: "Class", value: item.class },
      ...(item.durationSeconds === null ? [] : [{ kind: "text" as const, label: "Duration", value: `${Math.round(item.durationSeconds)} s` }]),
      ...(item.width === null || item.height === null ? [] : [{ kind: "text" as const, label: "Size", value: `${item.width}×${item.height}` }]),
      { kind: "count" as const, label: "Exports", value: item.exports.length },
      { kind: "text" as const, label: "Gathered by", value: item.gatheredBy.length === 0 ? "nothing (standing)" : item.gatheredBy.map((found) => found.title).join(", ") },
      ...state.at.map((row) => ({
        kind: "text" as const,
        label: row.channel.title,
        value: state.running[row.channel.channelId] !== undefined ? `Running: ${state.steps[row.channel.channelId] ?? ""}` : row.at.state === "published" ? "Published" : row.at.state === "retired" ? "Retired" : "Never published",
      })),
    ];
    bridge.inspector.actions = [
      ...(item.documentId === null ? [] : [{ kind: "button" as const, id: "open-document", label: "Open the document", run$: openDocument$ }]),
      ...state.at.filter((row) => state.running[row.channel.channelId] === undefined).flatMap((row) => [
        { kind: "button" as const, id: `publish-${row.channel.channelId}`, label: row.at.state === "published" ? `Publish to ${row.channel.title} again` : `Publish to ${row.channel.title}`, run$: $(() => act$(row.channel.channelId, "publish")) },
        ...(row.at.state === "published"
          ? [{ kind: "button" as const, id: `retire-${row.channel.channelId}`, label: `Retire at ${row.channel.title}`, destructive: true, run$: $(() => act$(row.channel.channelId, "retire")) }]
          : []),
      ]),
      { kind: "button" as const, id: "delete-item", label: "Delete item", destructive: true, run$: remove$ },
    ];
  });

  if (missing.value) {
    return (
      <div class="view view--item" data-view-body="item">
        <p data-item-missing>This item is gone.</p>
      </div>
    );
  }
  const item = state.item;
  if (item === null) {
    return (
      <div class="view view--item" data-view-body="item">
        <p data-item-loading>Reading the item…</p>
      </div>
    );
  }
  return (
    <div class="view view--item" data-view-body="item" data-item-class={item.class}>
      <header class="item__header">
        <input class="item__label" type="text" aria-label="Item label" value={state.label} data-item-label onInput$={(_, element) => (state.label = element.value)} onChange$={() => state.label.trim() !== item.label && revise$({ label: state.label })} />
        <p class="item__class">{item.class}</p>
      </header>
      {state.notice !== null && (
        <p class="item__notice" role="alert" data-item-notice>
          {state.notice}
        </p>
      )}
      <section class="item__section" data-item-words>
        <h2>Its own words</h2>
        <label>
          <span>Alt text</span>
          <input type="text" value={state.alt} data-item-alt onInput$={(_, element) => (state.alt = element.value)} onChange$={() => state.alt.trim() !== item.alt && revise$({ alt: state.alt })} />
        </label>
        <label>
          <span>Transcript</span>
          <textarea value={state.transcript} data-item-transcript onInput$={(_, element) => (state.transcript = element.value)} onChange$={() => state.transcript !== item.transcript && revise$({ transcript: state.transcript })} />
        </label>
        <label>
          <input type="checkbox" checked={item.synthetic} data-item-synthetic onChange$={(_, element) => revise$({ synthetic: element.checked })} />
          <span>Made with generative AI</span>
        </label>
      </section>
      {state.at.length > 0 && (
        <section class="item__section" data-item-at>
          <h2>At its channels</h2>
          {state.at.map((row) => (
            <div key={row.channel.channelId} class="item__channel" data-at-channel={row.channel.channelId} data-at-state={row.at.state}>
              <h3>
                {row.channel.title} · {row.at.state === "published" ? "Published" : row.at.state === "retired" ? "Retired" : "Never published"}
                {row.at.lastPublishedAt !== null && <span> · {row.at.lastPublishedAt}</span>}
                {row.at.state === "published" && row.at.externalId !== null && <span> · <code>{row.at.externalId}</code></span>}
              </h3>
              {row.missing.length > 0 && (
                <ul class="item__missing" data-at-missing>
                  {row.missing.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {row.at.lastAttempt !== null && row.at.lastAttempt.outcome === "failed" && <p data-at-last-attempt>Last attempt: {row.at.lastAttempt.detail}</p>}
            </div>
          ))}
        </section>
      )}
      {item.class === "prose" ? (
        <section class="item__section" data-item-document>
          <h2>Body</h2>
          <button type="button" class="item__action" data-open-document onClick$={() => openDocument$()}>
            Open the document
          </button>
        </section>
      ) : (
        <section class="item__section" data-item-exports>
          <h2>Exports</h2>
          <input
            ref={fileInput}
            type="file"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            data-export-upload-input
            onChange$={(_, element) => {
              const file = element.files?.[0];
              const replaces = replacing.value;
              replacing.value = "";
              if (file !== undefined) void send$("/exports", "POST", undefined, { file, query: `${replaces === "" ? "?" : `?replaces=${encodeURIComponent(replaces)}&`}filename=${encodeURIComponent(file.name)}` });
              element.value = "";
            }}
          />
          {item.exports.length === 0 ? (
            <p data-exports-empty>No exports.</p>
          ) : (
            <ul class="item__exports">
              {item.exports.map((found) => (
                <li key={found.exportId} data-export-row={found.exportId}>
                  {item.class === "image" && <img class="item__preview" src={`/v1/blobs/${encodeURIComponent(found.hash)}`} alt={item.alt} width={96} />}
                  <code>{found.mediaType}</code>
                  {found.width !== null && found.height !== null && <span> · {found.width}×{found.height}{found.aspect === null ? "" : ` (${found.aspect})`}</span>}
                  <span> · {mib(found.size)}</span>
                  <span> · {found.provenance}</span>
                  <button type="button" class="item__action" disabled={state.busy} data-export-replace={found.exportId} onClick$={() => { replacing.value = found.exportId; fileInput.value?.click(); }}>
                    Replace
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" class="item__action" disabled={state.busy} data-export-add onClick$={() => { replacing.value = ""; fileInput.value?.click(); }}>
            Add an export
          </button>
        </section>
      )}
    </div>
  );
});
