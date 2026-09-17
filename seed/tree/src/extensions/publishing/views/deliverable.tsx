import { $, component$, useContext, useSignal, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import type { AtChannel, DeliverableView as Deliverable, FilledPart } from "../lib/work";

/**
 * The deliverable tab: its shape's parts with what fills them, an upload
 * control and *Add existing* per part, release per member, nested
 * deliverables opening in their own tab. PU_0002_006
 */

const refusalOf = (body: unknown): string => {
  const failures = (body as { failures?: { detail: string }[] } | null)?.failures;
  return failures === undefined ? "It did not happen." : failures.map((failure) => failure.detail).join(" ");
};

const CARDINALITY_WORDS: Readonly<Record<string, string>> = { one: "exactly one", optional: "at most one", some: "one or more", any: "any number" };

export const DeliverableView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const missing = useSignal(false);
  const state = useStore<{ detail: Deliverable | null; notice: string | null; busy: boolean; reads: number; title: string; picking: string | null; picked: string; at: AtChannel[];
    running: Record<string, string>;
    steps: Record<string, string>; drafts: Record<string, string> }>({
    detail: null,
    notice: null,
    busy: false,
    reads: 0,
    title: "",
    picking: null,
    picked: "",
    at: [],
    drafts: {},
    // The process each channel's act runs as, by channel, and its last step. PU_0009_002
    running: {},
    steps: {},
  });
  const uploadFor = useSignal<string>("");
  const fileInput = useSignal<HTMLInputElement>();

  const read$ = $(async (deliverableId: string) => {
    const response = await fetch(`/api/x/publishing/deliverables/${deliverableId}`);
    const body = (await response.json()) as { outcome: "success"; result: Deliverable } | { outcome: string };
    if (body.outcome !== "success") {
      missing.value = true;
      return;
    }
    state.detail = (body as { result: Deliverable }).result;
    state.title = state.detail.title;
    // What this deliverable is at every channel that takes its shape. PU_0003_006
    const at = await fetch(`/api/x/publishing/deliverables/${deliverableId}/at`);
    const atBody = (await at.json()) as { outcome: "success"; result: AtChannel[] } | { outcome: string };
    if (atBody.outcome === "success") state.at = (atBody as { result: AtChannel[] }).result;
    // Counted once the rows are in, so the inspector draws them with the facts.
    state.reads += 1;
  });

  useVisibleTask$(async ({ track }) => {
    const deliverableId = track(() => tab.itemId);
    if (deliverableId === null) return;
    await read$(deliverableId);
  });

  const send$ = $(async (path: string, method: string, body?: unknown, raw?: { file: File; query: string }) => {
    const deliverableId = tab.itemId;
    if (deliverableId === null || state.busy) return false;
    state.notice = null;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/publishing/deliverables/${deliverableId}${path}${raw?.query ?? ""}`, {
        method,
        headers: raw === undefined ? { "content-type": "application/json" } : { "content-type": raw.file.type || "application/octet-stream", "x-filename": encodeURIComponent(raw.file.name) },
        ...(raw !== undefined ? { body: raw.file } : body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const outcome = (await response.json()) as { outcome: "success"; result: unknown } | { outcome: string };
      if (outcome.outcome !== "success") {
        state.notice = refusalOf(outcome);
        await read$(deliverableId);
        return false;
      }
      await read$(deliverableId);
      return outcome as { outcome: "success"; result: unknown };
    } finally {
      state.busy = false;
    }
  });

  const retitle$ = $(async () => {
    if (state.detail === null || state.title.trim() === state.detail.title) return;
    await send$("", "PUT", { title: state.title });
  });

  const upload$ = $(async (file: File) => {
    const partId = uploadFor.value;
    const part = state.detail?.parts.find((found) => found.part.partId === partId)?.part;
    if (part === undefined) return;
    await send$(`/parts/${partId}/upload`, "POST", undefined, { file, query: `?class=${encodeURIComponent(part.class)}&filename=${encodeURIComponent(file.name)}` });
  });

  const place$ = $(async (partId: string) => {
    if (state.picked === "") return;
    const done = await send$(`/parts/${partId}/items`, "POST", { itemId: state.picked });
    if (done) {
      state.picking = null;
      state.picked = "";
    }
  });

  const open$ = $((kind: "publishing:item" | "publishing:deliverable", itemId: string, title: string) => bridge.openTarget$({ kind, itemId, title }));

  const bind$ = $(async (channelId: string, values: Record<string, unknown>) => send$(`/at/${channelId}/binding`, "PUT", values));

  const rereadAt$ = $(async () => {
    const response = await fetch(`/api/x/publishing/deliverables/${tab.itemId}/at`);
    const body = (await response.json()) as { outcome: "success"; result: AtChannel[] } | { outcome: string };
    if (body.outcome === "success") state.at = (body as { result: AtChannel[] }).result;
  });

  // The act runs as a process the tab follows: the row's act is withheld while it runs, the
  // step shown as a fact, the rows read again when it ends, a failure said in the process's words. PU_0009_002
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
        if (process.state === "failed") state.notice = process.error ?? "It did not land.";
        else state.notice = null;
        break;
      }
    }
    const { [channelId]: _ended, ...rest } = state.running;
    state.running = rest;
    await rereadAt$();
  });

  const act$ = $(async (channelId: string, act: "publish" | "retire") => {
    const done = await send$(`/at/${channelId}/act`, "POST", { act, workspaceId: bridge.workspaceId });
    if (done !== false) {
      // A publish the projection refuses is answered, not logged: nothing was attempted. Say each rule.
      const answer = done.result as { released?: boolean; refusals?: { detail: string }[]; processId?: string } | null;
      if (answer !== null && answer.released === false) {
        state.notice = answer.refusals?.map((refusal) => refusal.detail).join(" ") || "It did not land.";
        return;
      }
      if (answer !== null && typeof answer.processId === "string") {
        await follow$(channelId, answer.processId);
        return;
      }
      const row = state.at.find((found) => found.channel.channelId === channelId);
      await rereadAt$();
      const after = state.at.find((found) => found.channel.channelId === channelId);
      if (after?.at.lastAttempt?.outcome === "failed") state.notice = after.at.lastAttempt.detail ?? "It did not land.";
      else if (row !== undefined && after !== undefined) state.notice = null;
    }
  });

  const remove$ = $(async () => {
    const detail = state.detail;
    if (detail === null) return;
    const done = await send$("", "DELETE", { baseRevisionId: detail.revisionId });
    if (done) missing.value = true;
  });

  useTask$(({ track }) => {
    const detail = track(() => state.detail);
    track(() => state.reads);
    track(() => state.at);
    track(() => state.running);
    track(() => state.steps);
    if (detail === null) return;
    const filled = detail.parts.reduce((count, part) => count + part.items.length + part.deliverables.length, 0);
    bridge.inspector.facts = [
      { kind: "text" as const, label: "Shape", value: detail.shapeTitle },
      { kind: "count" as const, label: "Items placed", value: filled },
    ];
    bridge.inspector.facts = [
      ...bridge.inspector.facts,
      ...state.at.map((row) => ({
        kind: "text" as const,
        label: row.channel.title,
        value: state.running[row.channel.channelId] !== undefined ? `Running: ${state.steps[row.channel.channelId] ?? ""}` : row.at.state === "published" ? "Published" : row.at.state === "retired" ? "Retired" : "Never published",
      })),
    ];
    bridge.inspector.actions = [
      ...state.at.filter((row) => state.running[row.channel.channelId] === undefined).flatMap((row) => [
        ...(row.binding.address !== null || !row.addressed
          ? [{ kind: "button" as const, id: `publish-${row.channel.channelId}`, label: row.at.state === "published" ? `Publish to ${row.channel.title} again` : `Publish to ${row.channel.title}`, run$: $(() => act$(row.channel.channelId, "publish")) }]
          : []),
        ...(row.at.state === "published"
          ? [{ kind: "button" as const, id: `retire-${row.channel.channelId}`, label: `Retire at ${row.channel.title}`, destructive: true, run$: $(() => act$(row.channel.channelId, "retire")) }]
          : []),
      ]),
      { kind: "button" as const, id: "delete-deliverable", label: "Delete deliverable", destructive: true, run$: remove$ },
    ];
  });

  if (missing.value) {
    return (
      <div class="view view--deliverable" data-view-body="deliverable">
        <p data-deliverable-missing>This deliverable is gone.</p>
      </div>
    );
  }
  const detail = state.detail;
  if (detail === null) {
    return (
      <div class="view view--deliverable" data-view-body="deliverable">
        <p data-deliverable-loading>Reading the deliverable…</p>
      </div>
    );
  }
  const candidatesFor = (part: FilledPart) => detail.candidates.filter((item) => item.class === part.part.class);
  return (
    <div class="view view--deliverable" data-view-body="deliverable">
      <header class="deliverable__header">
        <input class="deliverable__title" type="text" aria-label="Deliverable title" value={state.title} data-deliverable-title onInput$={(_, element) => (state.title = element.value)} onChange$={() => retitle$()} />
        <p class="deliverable__shape" data-deliverable-shape={detail.shapeId}>
          {detail.shapeTitle}
        </p>
      </header>
      {state.notice !== null && (
        <p class="deliverable__notice" role="alert" data-deliverable-notice>
          {state.notice}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        data-part-upload-input
        onChange$={(_, element) => {
          const file = element.files?.[0];
          if (file !== undefined) void upload$(file);
          element.value = "";
        }}
      />
      {state.at.length > 0 && (
        <section class="deliverable__channels" data-deliverable-channels>
          <h2>At its channels</h2>
          {state.at.map((row) => {
            const settled = row.binding.addressSettled;
            const draftKey = `${row.channel.channelId}:address`;
            return (
              <div key={row.channel.channelId} class="deliverable__channel" data-at-channel={row.channel.channelId} data-at-state={row.at.state}>
                <h3>
                  {row.channel.title} <code>{row.container}</code> ·{" "}
                  {row.at.state === "published" ? "Published" : row.at.state === "retired" ? "Retired" : "Never published"}
                  {row.at.lastPublishedAt !== null && <span> · {row.at.lastPublishedAt}</span>}
                </h3>
                {row.addressed &&
                  (settled ? (
                    <p data-at-address>Address: <code>{row.binding.address}</code> (published; retire there to move it)</p>
                  ) : (
                    <label>
                      <span>Address</span>
                      <input
                        type="text"
                        placeholder="a-slug-like-this"
                        value={state.drafts[draftKey] ?? row.binding.address ?? ""}
                        data-at-address-input
                        onInput$={(_, element) => (state.drafts[draftKey] = element.value)}
                        onChange$={() => bind$(row.channel.channelId, { address: state.drafts[draftKey] ?? "" })}
                      />
                    </label>
                  ))}
                {row.numbered && (
                  <label>
                    <span>Number</span>
                    <input type="number" min="1" value={row.binding.number ?? ""} data-at-number-input onChange$={(_, element) => bind$(row.channel.channelId, { number: element.value === "" ? null : Number(element.value) })} />
                  </label>
                )}
                {row.fields
                  .filter((field) => field.type !== "reference" || row.binding.fields[field.key] !== undefined)
                  .map((field) => {
                    const key = `${row.channel.channelId}:${field.key}`;
                    const held = row.binding.fields[field.key];
                    if (field.type === "entry") {
                      // An entry field names an item filling the slot it points at: chosen by label, never typed by id.
                      const choices = row.entries[field.slot ?? ""] ?? [];
                      const chosen = held === undefined || held === null ? [] : Array.isArray(held) ? (held as string[]) : [String(held)];
                      return (
                        <label key={field.key}>
                          <span>
                            {field.title}
                            {field.required && " (required)"}
                          </span>
                          {choices.length === 0 ? (
                            <span data-at-entry-none={field.key}>Nothing fills {field.slot ?? "that slot"} yet.</span>
                          ) : (
                            <select
                              multiple={field.many}
                              data-at-field={field.key}
                              onChange$={(_, element) => {
                                const picked = [...element.selectedOptions].map((option) => option.value).filter((value) => value !== "");
                                void bind$(row.channel.channelId, { fields: { [field.key]: field.many ? picked : (picked[0] ?? null) } });
                              }}
                            >
                              {!field.many && <option value="" selected={chosen.length === 0}>—</option>}
                              {choices.map((choice) => (
                                <option key={choice.itemId} value={choice.itemId} selected={chosen.includes(choice.itemId)}>
                                  {choice.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                      );
                    }
                    if (field.type === "flag") {
                      return (
                        <label key={field.key}>
                          <input type="checkbox" checked={held === true} data-at-field={field.key} onChange$={(_, element) => bind$(row.channel.channelId, { fields: { [field.key]: element.checked } })} />
                          <span>{field.title}</span>
                        </label>
                      );
                    }
                    return (
                      <label key={field.key}>
                        <span>
                          {field.title}
                          {field.required && " (required)"}
                        </span>
                        <input
                          type={field.type === "integer" ? "number" : field.type === "date" ? "date" : "text"}
                          value={state.drafts[key] ?? (held === undefined || held === null ? "" : Array.isArray(held) ? held.join(", ") : String(held))}
                          data-at-field={field.key}
                          onInput$={(_, element) => (state.drafts[key] = element.value)}
                          onChange$={() => {
                            const raw = state.drafts[key] ?? "";
                            const value = field.type === "integer" ? (raw === "" ? null : Number(raw)) : field.many ? raw.split(",").map((part) => part.trim()).filter((part) => part !== "") : raw === "" ? null : raw;
                            void bind$(row.channel.channelId, { fields: { [field.key]: value } });
                          }}
                        />
                      </label>
                    );
                  })}
                {row.missing.length > 0 && (
                  <ul class="deliverable__missing" data-at-missing>
                    {row.missing.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {row.at.lastAttempt !== null && row.at.lastAttempt.outcome === "failed" && (
                  <p data-at-last-attempt>Last attempt: {row.at.lastAttempt.detail}</p>
                )}
              </div>
            );
          })}
        </section>
      )}
      {detail.parts.length === 0 ? (
        <p data-deliverable-empty>Its shape has no parts yet.</p>
      ) : (
        detail.parts.map((filled) => {
          const part = filled.part;
          return (
            <section key={part.partId} class="deliverable__part" data-deliverable-part={part.partId} data-part-class={part.class}>
              <h2>
                {part.title} <code>{part.class === "shape" ? part.shapeTitle ?? "shape" : part.class}</code>
                <span> · {CARDINALITY_WORDS[part.cardinality] ?? part.cardinality}</span>
              </h2>
              {filled.items.length === 0 && filled.deliverables.length === 0 ? (
                <p data-part-empty>Nothing fills this part yet.</p>
              ) : (
                <ul class="deliverable__members">
                  {filled.items.map((item) => (
                    <li key={item.itemId} data-part-item={item.itemId}>
                      <button type="button" class="deliverable__member" onClick$={() => open$("publishing:item", item.itemId, item.label || item.class)}>
                        {item.label || `(untitled ${item.class})`}
                      </button>
                      <span> · {item.exportCount} export{item.exportCount === 1 ? "" : "s"}</span>
                      <button type="button" class="deliverable__action" aria-label={`Release ${item.label || item.class} from ${part.title}`} disabled={state.busy} data-release={item.itemId} onClick$={() => send$(`/parts/${part.partId}/members/${item.itemId}`, "DELETE")}>
                        Release
                      </button>
                    </li>
                  ))}
                  {filled.deliverables.map((inner) => (
                    <li key={inner.deliverableId} data-part-deliverable={inner.deliverableId}>
                      <button type="button" class="deliverable__member" onClick$={() => open$("publishing:deliverable", inner.deliverableId, inner.title)}>
                        {inner.title}
                      </button>
                      <button type="button" class="deliverable__action" aria-label={`Release ${inner.title} from ${part.title}`} disabled={state.busy} data-release={inner.deliverableId} onClick$={() => send$(`/parts/${part.partId}/members/${inner.deliverableId}`, "DELETE")}>
                        Release
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {part.class !== "shape" && part.class !== "prose" && (
                <button
                  type="button"
                  class="deliverable__action"
                  disabled={state.busy}
                  data-part-upload={part.partId}
                  onClick$={() => {
                    uploadFor.value = part.partId;
                    fileInput.value?.click();
                  }}
                >
                  Upload into {part.title}
                </button>
              )}
              {part.class !== "shape" && (
                <span class="deliverable__pick">
                  {state.picking === part.partId ? (
                    <>
                      <select aria-label={`Existing item for ${part.title}`} value={state.picked} data-part-pick={part.partId} onChange$={(_, element) => (state.picked = element.value)}>
                        <option value="">Choose an item</option>
                        {candidatesFor(filled).map((item) => (
                          <option key={item.itemId} value={item.itemId}>
                            {item.label || `(untitled ${item.class})`}
                          </option>
                        ))}
                      </select>
                      <button type="button" class="deliverable__action" disabled={state.busy || state.picked === ""} data-part-place={part.partId} onClick$={() => place$(part.partId)}>
                        Add
                      </button>
                      <button type="button" class="deliverable__action" onClick$={() => { state.picking = null; state.picked = ""; }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" class="deliverable__action" disabled={state.busy || candidatesFor(filled).length === 0} data-part-add-existing={part.partId} onClick$={() => { state.picking = part.partId; state.picked = ""; }}>
                      Add existing
                    </button>
                  )}
                </span>
              )}
            </section>
          );
        })
      )}
    </div>
  );
});
