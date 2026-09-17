import { $, component$, useContext, useSignal, useStore, useTask$, useVisibleTask$, type QRL } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import { isAddressed, isSingleton, type IndexField } from "../lib/content-index";
import type { ChannelDetail, IndexReadReport } from "../lib/library";
import type { ChannelSummary } from "../lib/library";
import type { PartView, ReleaseEntry, TakesView } from "../lib/work";
import { KindIcon } from "../components/icons";

/**
 * The channel tab: the title and the kind; the **Credential** section, which
 * is the state the settings row reports and a way to that row — the tab
 * holds no credential field of its own; and, for a kind that reads its offer
 * from the destination, what the site declared, read on demand because a
 * read reaches the destination. The inspector carries the channel's facts
 * and its acts. PU_0001_006
 */

const refusalOf = (body: unknown): string => {
  const failures = (body as { failures?: { detail: string }[] } | null)?.failures;
  return failures === undefined ? "It did not happen." : failures.map((failure) => failure.detail).join(" ");
};

/** A field as the tab reads it: its title, its type, and what a reference names. */
const fieldWords = (field: IndexField): string => {
  const kind =
    field.type === "reference"
      ? `${field.many ? "references" : "reference"} to ${field.container ?? "?"}`
      : field.type === "entry"
        ? `${field.many ? "entries" : "entry"} of ${field.slot ?? "?"}`
        : field.type;
  return `${field.title} (${kind}${field.required ? ", required" : ""})`;
};

const routeWords = (route: string): string =>
  isSingleton(route) ? "once" : isAddressed(route) ? "addressed by slug" : "numbered";

const STATE_WORDS: Readonly<Record<string, string>> = {
  unconfigured: "Not configured",
  configured: "Configured, not yet tested",
  verified: "Verified",
  failing: "Failing",
};

export const ChannelView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const missing = useSignal(false);
  const state = useStore<{
    detail: ChannelDetail | null;
    notice: string | null;
    report: IndexReadReport | null;
    busy: boolean;
    reads: number;
    takes: TakesView | null;
    released: ReleaseEntry[];
    takeShape: string;
    takeContainer: string;
    takesRefusal: string | null;
    indexNotice: string | null;
  }>({ detail: null, notice: null, report: null, busy: false, reads: 0, takes: null, released: [], takeShape: "", takeContainer: "", takesRefusal: null, indexNotice: null });

  const read$ = $(async (channelId: string) => {
    const response = await fetch(`/api/x/publishing/channels/${channelId}`);
    const body = (await response.json()) as { outcome: "success"; result: ChannelDetail } | { outcome: string };
    if (body.outcome !== "success") {
      missing.value = true;
      return;
    }
    state.detail = (body as { result: ChannelDetail }).result;
    state.reads += 1;
    // What the channel takes and what it published: read beside the channel,
    // a refused read leaving the section as it was. PU_0003_006
    const [takes, released] = await Promise.all([fetch(`/api/x/publishing/channels/${channelId}/takes`), fetch(`/api/x/publishing/channels/${channelId}/released`)]);
    const takesBody = (await takes.json()) as { outcome: "success"; result: TakesView } | { outcome: string };
    if (takesBody.outcome === "success") state.takes = (takesBody as { result: TakesView }).result;
    else state.takesRefusal = refusalOf(takesBody);
    const releasedBody = (await released.json()) as { outcome: "success"; result: ReleaseEntry[] } | { outcome: string };
    if (releasedBody.outcome === "success") state.released = (releasedBody as { result: ReleaseEntry[] }).result;
  });

  const send$ = $(async (path: string, method: string, body?: unknown) => {
    const channelId = tab.itemId;
    if (channelId === null || state.busy) return false;
    state.notice = null;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/publishing/channels/${channelId}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const outcome = (await response.json()) as { outcome: string };
      if (outcome.outcome !== "success") {
        state.notice = refusalOf(outcome);
        return false;
      }
      await read$(channelId);
      return true;
    } finally {
      state.busy = false;
    }
  });

  // A visible task because it fetches: a task running during server
  // rendering has no page to resolve `/api/...` against.
  useVisibleTask$(async ({ track }) => {
    const channelId = track(() => tab.itemId);
    if (channelId === null) return;
    await read$(channelId);
  });

  const openSettings$ = $(() =>
    bridge.openTarget$({ kind: "settings:settings", itemId: "instance", title: "Settings" }),
  );

  const readIndex$ = $(async () => {
    const channelId = tab.itemId;
    if (channelId === null || state.busy) return;
    state.indexNotice = null;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/publishing/channels/${channelId}/index/read`, { method: "POST" });
      const body = (await response.json()) as { outcome: "success"; result: IndexReadReport } | { outcome: string };
      if (body.outcome !== "success") {
        // Beside the control that asked, where the eye is.
        state.indexNotice = refusalOf(body);
        return;
      }
      state.report = (body as { result: IndexReadReport }).result;
      await read$(channelId);
    } finally {
      state.busy = false;
    }
  });

  const retire$ = $(async () => {
    const detail = state.detail;
    if (detail === null) return;
    await send$("/retire", "POST", { baseRevisionId: detail.revisionId });
  });

  const remove$ = $(async () => {
    const channelId = tab.itemId;
    const detail = state.detail;
    if (channelId === null || detail === null || state.busy) return;
    state.notice = null;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/publishing/channels/${channelId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseRevisionId: detail.revisionId }),
      });
      const body = (await response.json()) as { outcome: string };
      if (body.outcome !== "success") {
        state.notice = refusalOf(body);
        return;
      }
      missing.value = true;
    } finally {
      state.busy = false;
    }
  });

  useTask$(({ track }) => {
    const detail = track(() => state.detail);
    track(() => state.reads);
    if (detail === null) return;
    bridge.inspector.facts = [
      { kind: "text" as const, label: "Kind", value: detail.kindSummary.label },
      { kind: "text" as const, label: "State", value: STATE_WORDS[detail.credential.state] ?? detail.credential.state },
      ...(detail.credential.lastTestedAt === null
        ? []
        : [{ kind: "time" as const, label: "Tested", value: detail.credential.lastTestedAt }]),
      ...(detail.index === null ? [] : [{ kind: "time" as const, label: "Index read", value: detail.index.readAt }]),
    ];
    bridge.inspector.actions = [
      ...(detail.kindSummary.readsIndex
        ? [{ kind: "button" as const, id: "read-index", label: "Read the site's index", run$: readIndex$ }]
        : []),
      ...(state.released.some((entry) => entry.outcome === "succeeded") && !detail.channel.retired
        ? [{ kind: "button" as const, id: "retire-channel", label: "Retire channel", destructive: true, run$: retire$ }]
        : []),
      { kind: "button" as const, id: "delete-channel", label: "Delete channel", destructive: true, run$: remove$ },
    ];
  });

  if (missing.value) {
    return (
      <div class="view view--channel" data-view-body="channel">
        <p data-channel-missing>This channel is gone.</p>
      </div>
    );
  }
  const detail = state.detail;
  if (detail === null) {
    return (
      <div class="view view--channel" data-view-body="channel">
        <p data-channel-loading>Reading the channel…</p>
      </div>
    );
  }
  const credential = detail.credential;
  return (
    <div class="view view--channel" data-view-body="channel" data-channel-state={credential.state}>
      <header class="channel__header">
        <h1 class="channel__title">
          <KindIcon kind={detail.channel.kind} />
          <span>{detail.channel.title}</span>
        </h1>
        <p class="channel__kind" data-channel-kind={detail.channel.kind}>
          {detail.kindSummary.label}
        </p>
      </header>
      {state.notice !== null && (
        <p class="channel__notice" role="alert" data-channel-notice>
          {state.notice}
        </p>
      )}
      <section class="channel__section" data-channel-credential>
        <h2>Credential</h2>
        <dl class="channel__facts">
          <dt>State</dt>
          <dd data-credential-state>{STATE_WORDS[credential.state] ?? credential.state}</dd>
          {detail.kindSummary.fields.map((field) => (
            <>
              <dt key={`${field.key}-t`}>{field.label}</dt>
              <dd key={`${field.key}-d`} data-credential-field={field.key}>
                {credential.configuration[field.key] ?? "—"}
              </dd>
            </>
          ))}
          <dt>Key</dt>
          <dd data-credential-key>{credential.keySet ? "Set" : "Not set"}</dd>
          {credential.lastError !== null && (
            <>
              <dt>Last said</dt>
              <dd data-credential-error>{credential.lastError}</dd>
            </>
          )}
        </dl>
        <p class="channel__hint">
          The address and the key are entered, tested and cleared on this channel's row in Settings.
        </p>
        <button type="button" class="channel__action" data-open-settings onClick$={() => openSettings$()}>
          Open Settings
        </button>
      </section>
      {detail.kindSummary.readsIndex && (
        <section class="channel__section" data-channel-index>
          <h2>What the site declares</h2>
          {detail.index === null ? (
            <p data-index-unread>The site's index has not been read yet.</p>
          ) : (
            <>
              <p data-index-read-at>Read {detail.index.readAt}</p>
              {state.report !== null && (state.report.retired.length > 0 || state.report.dropped.length > 0 || state.report.reclassed.length > 0) && (
                <p data-index-changes>
                  {state.report.retired.length > 0 && `No longer listed but kept: ${state.report.retired.join(", ")}. `}
                  {state.report.dropped.length > 0 && `No longer listed: ${state.report.dropped.join(", ")}. `}
                  {state.report.reclassed.length > 0 && `Changed class: ${state.report.reclassed.join(", ")}.`}
                </p>
              )}
              <h3>Containers</h3>
              {detail.index.containers.length === 0 ? (
                <p>None.</p>
              ) : (
                <ul class="channel__list" data-index-containers>
                  {detail.index.containers.map((kept) => (
                    <li key={kept.entry.key} data-index-container={kept.entry.key} data-in-index={kept.inIndex ? "true" : "false"}>
                      <strong>{kept.entry.title}</strong> <code>{kept.entry.route}</code>
                      <span data-container-placement={routeWords(kept.entry.route)}> · {routeWords(kept.entry.route)}</span>
                      {!kept.inIndex && <em> no longer in the index</em>}
                      {kept.entry.fields.length > 0 && (
                        <span data-container-fields> — fields: {kept.entry.fields.map(fieldWords).join(", ")}</span>
                      )}
                      <ul>
                        {detail.index!.slots
                          .filter((slot) => slot.entry.container === kept.entry.key)
                          .map((slot) => (
                            <li key={slot.entry.key} data-index-slot={slot.entry.key} data-in-index={slot.inIndex ? "true" : "false"}>
                              {slot.entry.title} <code>{slot.entry.class}</code>
                              {slot.entry.required && <span> · required</span>}
                              {slot.entry.aspect !== null && <span> · {slot.entry.aspect}</span>}
                              {slot.entry.aspects.length > 0 && <span data-slot-aspects> · crops {slot.entry.aspects.join(", ")}</span>}
                              {slot.entry.formats.length > 0 && <span> · {slot.entry.formats.join(", ")}</span>}
                              {slot.entry.maxDurationSeconds !== null && <span> · ≤{slot.entry.maxDurationSeconds}s</span>}
                              {slot.entry.maxLength !== null && <span> · ≤{slot.entry.maxLength} characters</span>}
                              {slot.entry.maxCount !== null && <span> · up to {slot.entry.maxCount}</span>}
                              {slot.entry.fields.length > 0 && (
                                <span data-slot-fields> — fields: {slot.entry.fields.map(fieldWords).join(", ")}</span>
                              )}
                              {!slot.inIndex && <em> no longer in the index</em>}
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
              <h3>Copy</h3>
              {detail.index.copy.length === 0 ? (
                <p>None.</p>
              ) : (
                <ul class="channel__list" data-index-copy>
                  {detail.index.copy.map((kept) => (
                    <li key={kept.entry.key} data-index-copy-field={kept.entry.key} data-in-index={kept.inIndex ? "true" : "false"}>
                      {kept.entry.title} <code>{kept.entry.type}</code>
                      {kept.entry.group !== "" && <span> · {kept.entry.group}</span>}
                      {!kept.inIndex && <em> no longer in the index</em>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button type="button" class="channel__action" data-read-index disabled={state.busy} onClick$={() => readIndex$()}>
            {detail.index === null ? "Read the site's index" : "Read the site's index again"}
          </button>
          {state.indexNotice !== null && (
            <p class="channel__notice" role="alert" data-index-notice>
              {state.indexNotice}
            </p>
          )}
        </section>
      )}
      {detail.kindSummary.readsIndex && (detail.index === null || state.takes === null) && (
        <section class="channel__section" data-channel-takes>
          <h2>Takes</h2>
          <p data-takes-unavailable>
            {detail.index === null
              ? "Read the site's index first; a shape is taken into a container the site declares."
              : (state.takesRefusal ?? "What this channel takes could not be read.")}
          </p>
        </section>
      )}
      {detail.kindSummary.readsIndex && detail.index !== null && state.takes !== null && (
        <section class="channel__section" data-channel-takes>
          <h2>Takes</h2>
          {state.takes.assignments.length === 0 ? (
            <p data-takes-empty>This channel takes no shape yet.</p>
          ) : (
            state.takes.assignments.map((assignment) => {
              const shape = assignment.shape;
              const slots = detail.index!.slots.filter((kept) => kept.inIndex && kept.entry.container === assignment.container).map((kept) => kept.entry);
              return (
                <div key={assignment.assignmentId} class="channel__assignment" data-takes-shape={shape.shapeId}>
                  <h3>
                    {shape.title} → <code>{assignment.container}</code>
                    <button type="button" class="channel__action" disabled={state.busy} data-drop-shape={shape.shapeId} onClick$={() => send$(`/takes/${shape.shapeId}`, "DELETE")}>
                      Drop
                    </button>
                  </h3>
                  {assignment.missing.length > 0 && (
                    <p data-takes-missing>Required and unfilled: {assignment.missing.join(", ")}</p>
                  )}
                  <ul>
                    {assignment.parts.map((entry) => (
                      <li key={entry.part} data-takes-part={entry.part}>
                        {assignment.shapeParts.find((part) => part.partId === entry.part)?.title ?? entry.part.slice(0, 8)} → {entry.slot}
                        {entry.host !== null && <span data-takes-host={entry.host}> at {state.takes?.videoHosts.find((host) => host.channelId === entry.host)?.title ?? entry.host}</span>}
                        <button type="button" class="channel__action" disabled={state.busy} data-release-part={entry.part} onClick$={() => send$(`/takes/${shape.shapeId}/parts/${entry.part}`, "DELETE")}>
                          Unassign
                        </button>
                      </li>
                    ))}
                  </ul>
                  <AssignPart shapeId={shape.shapeId} parts={assignment.shapeParts.filter((part) => !assignment.parts.some((entry) => entry.part === part.partId))} slots={slots.map((slot) => ({ key: slot.key, class: slot.class }))} containers={detail.index!.containers.filter((kept) => kept.inIndex).map((kept) => kept.entry.key)} hosts={state.takes?.videoHosts ?? []} busy={state.busy} assign$={$(async (partId: string, slot: string, host: string | null) => { await send$(`/takes/${shape.shapeId}/parts/${partId}`, "PUT", { slot, ...(host === null ? {} : { host }) }); })} />
                </div>
              );
            })
          )}
          <form
            class="channel__take"
            data-take-form
            preventdefault:submit
            onSubmit$={() =>
              send$("/takes", "POST", {
                shapeId: state.takeShape || (state.takes?.shapes[0]?.shapeId ?? ""),
                container: state.takeContainer || (detail.index?.containers.find((kept) => kept.inIndex)?.entry.key ?? ""),
              })
            }
          >
            <label>
              <span>Take</span>
              <select data-take-shape value={state.takeShape} onChange$={(_, element) => (state.takeShape = element.value)}>
                {state.takes.shapes.map((shape) => (
                  <option key={shape.shapeId} value={shape.shapeId}>
                    {shape.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>into</span>
              <select data-take-container value={state.takeContainer} onChange$={(_, element) => (state.takeContainer = element.value)}>
                {detail.index.containers
                  .filter((kept) => kept.inIndex)
                  .map((kept) => (
                    <option key={kept.entry.key} value={kept.entry.key}>
                      {kept.entry.title}
                    </option>
                  ))}
              </select>
            </label>
            <button type="submit" class="channel__action" disabled={state.busy || state.takes.shapes.length === 0} data-take-submit>
              Take
            </button>
          </form>
        </section>
      )}
      <section class="channel__section" data-channel-published>
        <h2>Published</h2>
        {state.released.length === 0 ? (
          <p data-published-empty>Nothing was published to this channel yet.</p>
        ) : (
          <ul class="channel__list" data-published-list>
            {state.released.map((entry) => (
              <li key={entry.releaseId} data-release={entry.releaseId} data-release-outcome={entry.outcome}>
                <strong>{entry.recordTitle || entry.recordId}</strong> · {entry.act} · {entry.outcome} · {entry.at}
                {entry.externalAddress !== null && <span> · <code>{entry.externalAddress}</code></span>}
                {entry.detail !== null && <span> · {entry.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
});

/**
 * A part chosen by its title among the shape's unassigned ones and a slot
 * chosen by key, assigned on press; a video slot asks for the channel that
 * hosts the part's videos too. PU_0004_002
 */
const AssignPart = component$<{ shapeId: string; parts: readonly PartView[]; slots: readonly { key: string; class: string }[]; containers: readonly string[]; hosts: readonly ChannelSummary[]; busy: boolean; assign$: QRL<(partId: string, slot: string, host: string | null) => Promise<void>> }>(({ shapeId, parts, slots, containers, hosts, busy, assign$ }) => {
  // The slots offered follow the chosen part: those of its class, or the containers for a nested part.
  const optionsFor = (chosen: string): string[] => {
    const part = parts.find((candidate) => candidate.partId === chosen);
    if (part === undefined) return [];
    return part.class === "shape" ? [...containers] : slots.filter((candidate) => candidate.class === part.class).map((candidate) => candidate.key);
  };
  const partId = useSignal(parts[0]?.partId ?? "");
  const slot = useSignal(optionsFor(parts[0]?.partId ?? "")[0] ?? "");
  const host = useSignal(hosts[0]?.channelId ?? "");
  if (parts.length === 0) return <p data-assign-none>Every part of this shape is assigned.</p>;
  const options = optionsFor(partId.value);
  const videoSlot = slots.find((candidate) => candidate.key === slot.value)?.class === "video" && parts.find((candidate) => candidate.partId === partId.value)?.class === "video";
  return (
    <form class="channel__assign" data-assign-form={shapeId} preventdefault:submit onSubmit$={() => assign$(partId.value.trim(), slot.value, videoSlot && host.value !== "" ? host.value : null)}>
      <select
        aria-label="Part"
        value={partId.value}
        data-assign-part
        onChange$={(_, element) => {
          partId.value = element.value;
          slot.value = optionsFor(element.value)[0] ?? "";
        }}
      >
        {parts.map((part) => (
          <option key={part.partId} value={part.partId}>
            {`${part.title} (${part.class})`}
          </option>
        ))}
      </select>
      {options.length === 0 ? (
        <span data-assign-no-slot>The container has no slot of this class.</span>
      ) : (
        <select aria-label="Slot" value={slot.value} data-assign-slot onChange$={(_, element) => (slot.value = element.value)}>
          {options.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      )}
      {videoSlot &&
        (hosts.length === 0 ? (
          <span data-assign-no-host>No Bunny Stream channel to host it yet; create one under Channels.</span>
        ) : (
          <select aria-label="Video host" value={host.value} data-assign-host onChange$={(_, element) => (host.value = element.value)}>
            {hosts.map((candidate) => (
              <option key={candidate.channelId} value={candidate.channelId}>
                {`at ${candidate.title}`}
              </option>
            ))}
          </select>
        ))}
      <button type="submit" class="channel__action" disabled={busy || partId.value.trim() === "" || options.length === 0} data-assign-submit>
        Assign
      </button>
    </form>
  );
});
