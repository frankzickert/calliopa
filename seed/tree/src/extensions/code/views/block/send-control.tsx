import { $, component$, useContext, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";
import { branchOf } from "~/extensions/documents/lib/branch-scope";
import { tracebackSegments } from "~/extensions/documents/lib/traceback";
import { liveLine, type LiveLine } from "../../lib/live-lines";
import type { Permissions } from "../../lib/types";

import { SessionContext } from "../session/context";

import "../code.css";

/**
 * The send beneath a code block (`BO_0289_019`), drawn in the `run` place the
 * documents extension leaves under a code block's source: *Run* sends the
 * block to the document's session and shows what streams back while it
 * runs; *Stop* interrupts it; and when it is done the output stands as a
 * proposal after the block, which the editor draws as it draws every
 * proposal. A block whose document is connected to no runtime says so
 * instead of running.
 *
 * What runs is what the person last typed: the send first settles the edit
 * — the field left, the block's own revise on its way — and waits for the
 * block to stop saying it is sending before it asks the kernel to run the
 * revision it then holds.
 */
interface Live {
  phase: "idle" | "waiting" | "running" | "done" | "failed";
  lines: LiveLine[];
  note: string;
  execution: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What a grant lets a block reach, in words. BO_0319_046 */
export function grantWords(grant: Permissions): string {
  const reach: string[] = [];
  if (grant.attachments) reach.push("reads the document's files");
  if (grant.hosts.length > 0) reach.push(`fetches from ${grant.hosts.join(", ")}`);
  return reach.length === 0
    ? "Runs in this device's sandbox and reaches nothing beyond compute."
    : `Runs in this device's sandbox and ${reach.join(" and ")}.`;
}

/**
 * A code block's grant on a device (`calliopa-bootstrap`'s BO_0319_046): what
 * it may reach beyond compute — the document's files, and the hosts the
 * person names — shown under the block and granted or withdrawn there, each
 * change written on the block at once. Drawn when the document is connected
 * to the device's sandbox; a runtime's network is the code service's.
 */
const BlockPermissions = component$<{ documentId: string; blockId: string }>(({ documentId, blockId }) => {
  const grant = useStore<{ loaded: boolean; attachments: boolean; hosts: string[]; host: string; busy: boolean; refusal: string }>({
    loaded: false,
    attachments: false,
    hosts: [],
    host: "",
    busy: false,
    refusal: "",
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the grant is the kernel's, read in the browser with the person's session
  useVisibleTask$(async () => {
    const answer = await fetch(
      `/api/x/code/permissions?artifact=${encodeURIComponent(documentId)}&block=${encodeURIComponent(blockId)}`,
    ).catch(() => null);
    if (answer?.ok) {
      const { permissions } = (await answer.json()) as { permissions: Permissions };
      grant.attachments = permissions.attachments;
      grant.hosts = [...permissions.hosts];
    }
    grant.loaded = true;
  });

  const write$ = $(async (next: Permissions) => {
    grant.busy = true;
    grant.refusal = "";
    try {
      const answer = await fetch("/api/x/code/permissions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifact: documentId, block: blockId, ...next }),
      });
      const body = (await answer.json().catch(() => ({}))) as { permissions?: Permissions; error?: string; message?: string };
      if (!answer.ok || body.permissions === undefined) {
        grant.refusal = body.message ?? body.error ?? `The grant could not be written (${answer.status}).`;
        return;
      }
      grant.attachments = body.permissions.attachments;
      grant.hosts = [...body.permissions.hosts];
      grant.host = "";
    } finally {
      grant.busy = false;
    }
  });

  if (!grant.loaded) return null;
  return (
    <div class="code-grant" data-code-grant={blockId}>
      <p class="code-run__hint" data-code-grant-words>
        {grantWords({ attachments: grant.attachments, hosts: grant.hosts })}
      </p>
      <label class="code-grant__item">
        <input
          type="checkbox"
          data-code-grant-attachments
          checked={grant.attachments}
          disabled={grant.busy}
          onChange$={(_, element) => write$({ attachments: element.checked, hosts: grant.hosts })}
        />
        <span>Read the document's files</span>
      </label>
      <ul class="code-grant__hosts" data-code-grant-hosts>
        {grant.hosts.map((host) => (
          <li key={host} data-code-grant-host={host}>
            <span>{host}</span>
            <button
              type="button"
              class="code-run__button"
              aria-label={`Withdraw ${host}`}
              disabled={grant.busy}
              onClick$={() => write$({ attachments: grant.attachments, hosts: grant.hosts.filter((held) => held !== host) })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        class="code-grant__add"
        preventdefault:submit
        onSubmit$={() => {
          const host = grant.host.trim().toLowerCase();
          if (host !== "") void write$({ attachments: grant.attachments, hosts: [...grant.hosts, host] });
        }}
      >
        <input
          type="text"
          placeholder="example.org"
          aria-label="A host this block may fetch from"
          data-code-grant-host-input
          value={grant.host}
          disabled={grant.busy}
          onInput$={(_, element) => (grant.host = element.value)}
        />
        <button type="submit" class="code-run__button" data-code-grant-add disabled={grant.busy || grant.host.trim() === ""}>
          Allow host
        </button>
      </form>
      {grant.refusal !== "" && (
        <p class="code-run__note" role="alert" data-code-grant-refusal>
          {grant.refusal}
        </p>
      )}
    </div>
  );
});

export const SendControl = component$<BlockDecorationProps>(({ documentId, blockId }) => {
  const session = useContext(SessionContext);
  const root = useSignal<HTMLElement>();
  const live = useStore<Live>({ phase: "idle", lines: [], note: "", execution: "" });

  const run$ = $(async () => {
    if (live.phase === "waiting" || live.phase === "running") return;
    live.phase = "waiting";
    live.lines = [];
    live.note = "";
    // The edit settles first: the block says it is sending while its own
    // revise is on its way, and the run waits for that to clear.
    const figure = root.value?.previousElementSibling as HTMLElement | null;
    if (figure?.matches("[data-code-block]")) {
      const field = figure.querySelector("textarea");
      if (field !== null && document.activeElement === field) field.blur();
      await sleep(80);
      const until = Date.now() + 5000;
      while (figure.hasAttribute("data-code-sending") && Date.now() < until) await sleep(50);
    }
    const branch = branchOf(documentId);
    let answer: Response;
    try {
      answer = await fetch("/__kernel/code/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifact: documentId, block: blockId, ...(branch === null ? {} : { group: branch }) }),
      });
    } catch {
      live.phase = "failed";
      live.note = "The kernel could not be reached.";
      return;
    }
    if (!answer.ok || answer.body === null) {
      const refusal = (await answer.json().catch(() => ({}))) as { diagnostics?: { message: string }[] };
      live.phase = "failed";
      live.note = refusal.diagnostics?.[0]?.message ?? `The kernel answered ${answer.status}.`;
      return;
    }
    live.phase = "running";
    session.running = "running";
    const reader = answer.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut = buffer.indexOf("\n\n");
      while (cut >= 0) {
        const chunk = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        cut = buffer.indexOf("\n\n");
        const line = chunk.split("\n").find((part) => part.startsWith("data: "));
        if (line === undefined) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line.slice(6)) as Record<string, unknown>;
        } catch {
          continue;
        }
        switch (event["event"]) {
          case "started":
            live.execution = String(event["execution"] ?? "");
            break;
          case "stream":
          case "error":
          case "display":
          case "result":
          case "cut": {
            // An error is its traceback, drawn in colour below. BO_0296_019
            const shown = liveLine(event);
            if (shown !== null) live.lines = [...live.lines, shown];
            break;
          }
          case "done": {
            const status = String(event["status"] ?? "");
            session.running = "";
            if (status === "failed" || status === "unproposed") {
              live.phase = "failed";
              live.note = String(event["error"] ?? "The execution failed.");
            } else {
              live.phase = "done";
              const elapsed = typeof event["elapsed"] === "number" ? ` in ${(event["elapsed"] as number).toFixed(2)} s` : "";
              live.note = `${status}${elapsed}; the output is proposed below.`;
              // The editor reads the document's proposals again on this
              // event, since no run staged the output. BO_0289_023
              root.value?.dispatchEvent(new CustomEvent("calliopa:document-proposed", { bubbles: true, detail: { documentId } }));
            }
            break;
          }
          default:
            break;
        }
      }
    }
    if (live.phase === "running") {
      live.phase = "failed";
      live.note = "The stream ended before the execution was done.";
      session.running = "";
    }
  });

  const stop$ = $(async () => {
    await fetch("/api/x/code/interrupt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifact: documentId }),
    });
  });

  if (!session.reachable) return null;
  const connected = session.runtime !== null;
  // On a device the block runs in the sandbox under its own grant, and a run
  // held to its deadline has nothing to stop. BO_0319_046
  const sandboxed = session.runtimes.find((record) => record.id === session.runtime)?.sandbox === true;
  const busy = live.phase === "waiting" || live.phase === "running";
  return (
    <div ref={root} class="code-run" data-code-run={blockId} data-code-run-phase={live.phase}>
      <div class="code-run__controls">
        <button
          type="button"
          class="code-run__button"
          data-code-run-send
          disabled={!connected || busy}
          title={connected ? `Run this block on ${session.runtimeName || "the runtime"}` : "Connect a runtime in the document's bar to run this"}
          onClick$={run$}
        >
          Run
        </button>
        {busy && !sandboxed && (
          <button type="button" class="code-run__button" data-code-run-stop onClick$={stop$}>
            Stop
          </button>
        )}
        {!connected && (
          <span class="code-run__hint" data-code-run-hint>
            Connect a runtime to run this.
          </span>
        )}
        {live.note !== "" && (
          <span class="code-run__note" data-code-run-note>
            {live.note}
          </span>
        )}
      </div>
      {sandboxed && <BlockPermissions documentId={documentId} blockId={blockId} />}
      {/* What streamed stays until the next run, so a reader who missed
          it while it ran still sees it beside the proposal below. */}
      {live.lines.length > 0 && (
        <pre class="code-run__live" data-code-live>
          {live.lines.map((line, at) =>
            line.kind === "error" ? (
              <span key={at} class="code-run__error" data-code-live-error>
                {tracebackSegments(line.text).map((segment, part) =>
                  segment.kind === "text" ? (
                    segment.text
                  ) : (
                    <span key={part} class={`code-run__error-${segment.kind}`} data-error-token={segment.kind}>
                      {segment.text}
                    </span>
                  ),
                )}
              </span>
            ) : (
              line.text
            )
          )}
        </pre>
      )}
    </div>
  );
});
