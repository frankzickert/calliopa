import { $, component$, useContext, useSignal, useStore } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";
import { branchOf } from "~/extensions/documents/lib/branch-scope";

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
  lines: string[];
  note: string;
  execution: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
            live.lines = [...live.lines, String(event["text"] ?? "")];
            break;
          case "error":
            live.lines = [...live.lines, `${String(event["name"] ?? "")}: ${String(event["value"] ?? "")}\n`];
            break;
          case "display":
          case "result": {
            const data = (event["data"] ?? {}) as Record<string, unknown>;
            const plain = data["text/plain"];
            live.lines = [...live.lines, typeof plain === "string" ? `${plain}\n` : "a picture\n"];
            break;
          }
          case "cut":
            live.lines = [...live.lines, `[cut: ${String(event["reason"] ?? "")}]\n`];
            break;
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
        {busy && (
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
      {/* What streamed stays until the next run, so a reader who missed
          it while it ran still sees it beside the proposal below. */}
      {live.lines.length > 0 && (
        <pre class="code-run__live" data-code-live>
          {live.lines.join("")}
        </pre>
      )}
    </div>
  );
});
