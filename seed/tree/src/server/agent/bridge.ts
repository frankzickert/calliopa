import type { CommandTarget } from "~/lib/command-target";
import type { HermesModel } from "~/lib/connections";
import { graphEnv } from "../ccgw/env";
import { forwardedCookie } from "../request-context";
import type { RunEvent } from "./run-events";

/**
 * The kernel's agent bridge, as the shell reaches it (`ui-kernel.md`,
 * `BO_0089_012`). Since `BO_0207_015` the shell starts no run of its own: a
 * goal goes to `POST /__kernel/agent/runs`, which binds the agent principal,
 * the identity class, the pin and the run's proposal group server-side and
 * hands the goal to Hermes with the kernel toolset — the document tools
 * included (`BO_0207_004`). The shell follows the run through the bridge's
 * event stream and reports it through the process registry as before.
 *
 * Everything bridge-shaped stops here and at the event contract beside it:
 * the bridge's normalized events become the console's `RunEvent`s, and the
 * console never learns the bridge's own JSON.
 */

export type BridgeReply<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly status: number; readonly detail: string };

/** A run as the bridge records it. Only what the shell reads is named. */
export interface BridgeRun {
  readonly id: string;
  readonly goal: string;
  readonly group?: string;
  readonly staged: boolean;
  readonly pin: number;
  readonly status: string;
  readonly agent?: string;
}

/** One normalized event on the bridge's stream. */
interface BridgeEvent {
  readonly type: string;
  readonly text?: string;
  readonly tool?: string;
  readonly ok?: boolean;
  readonly group?: string;
  readonly error?: string;
  readonly at: number;
}

function base(): string {
  return `${graphEnv().kernelUrl}/__kernel/agent`;
}

async function ask<T>(path: string, init: RequestInit, read: (body: unknown) => T): Promise<BridgeReply<T>> {
  // The agent surface is read as the person whose browser asked; in prod the
  // kernel admits nobody else. BO_0209_002
  const cookie = forwardedCookie();
  const headers = new Headers(init.headers);
  if (cookie !== undefined && !headers.has("cookie")) headers.set("cookie", cookie);
  let response: Response;
  try {
    response = await fetch(`${base()}${path}`, { ...init, headers });
  } catch (error) {
    return { ok: false, status: 503, detail: `The kernel could not be reached: ${String(error)}` };
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = (body as { error?: string } | null)?.error;
    return { ok: false, status: response.status, detail: error ?? `The kernel answered ${response.status}.` };
  }
  return { ok: true, value: read(body) };
}

/**
 * Starts a run. The runtime is the kernel's configured selection unless one
 * is named; the context tells the run where it was asked from, and a target
 * what it was aimed at — the document, where its work goes, and what the
 * reader marked, which the intake has taken as fields since `BO_0173` and
 * `BO_0226_001`. A command aimed at nothing sends none of them.
 */
export function startBridgeRun(input: {
  readonly goal: string;
  readonly context?: string;
  readonly agent?: string;
  readonly target?: CommandTarget | null;
}): Promise<BridgeReply<BridgeRun>> {
  const target = input.target ?? null;
  return ask(
    "/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: input.goal,
        context: input.context ?? "",
        agent: input.agent ?? "",
        ...(target === null
          ? {}
          : {
              artifact: target.artifact,
              delivery: target.delivery,
              // A passage travels with its words; a block with its identity
              // alone. BO_0227_015
              references: target.references,
            }),
      }),
    },
    (body) => (body as { run: BridgeRun }).run,
  );
}

/**
 * Whether the Claude runner answers, from the kernel's agent health: `ok`,
 * the kernel's words for why not, or null when it said nothing about the
 * runner — which is what a kernel without one, or one that could not be
 * reached, says. BO_0228_009
 */
export async function claudeRunnerHealth(): Promise<string | null> {
  const reply = await ask("/health", { method: "GET" }, (body) => {
    const claude = (body as { claude?: unknown } | null)?.claude;
    return typeof claude === "string" ? claude : null;
  });
  return reply.ok ? reply.value : null;
}

/**
 * Sets what Hermes's own loop reasons with. The kernel refuses the API-key
 * model while none is configured, in its own words, rather than writing a
 * choice that would fall back. BO_0228_012
 */
export function configureHermesModel(model: HermesModel): Promise<BridgeReply<HermesModel>> {
  return ask(
    "/config",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hermesModel: model }) },
    () => model,
  );
}

export function readBridgeRun(runId: string): Promise<BridgeReply<BridgeRun>> {
  return ask(`/runs/${encodeURIComponent(runId)}`, { method: "GET" }, (body) => (body as { run: BridgeRun }).run);
}

export function cancelBridgeRun(runId: string): Promise<BridgeReply<string>> {
  return ask(
    `/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    () => runId,
  );
}

/**
 * One bridge event as the console reads it. The bridge's vocabulary maps onto
 * the contract's kinds; a staged proposal is reported as the agent saying so,
 * since it is what the reader most wants to hear from a run.
 */
export function translateBridgeEvent(runId: string, event: BridgeEvent): RunEvent | null {
  const at = typeof event.at === "number" && event.at > 0 ? event.at : Date.now();
  switch (event.type) {
    case "run.started":
      return { kind: "runStarted", runId, at };
    case "assistant.delta":
      return { kind: "assistantDelta", runId, at, text: event.text ?? "" };
    case "tool.started":
      return { kind: "toolStarted", runId, at, tool: event.tool ?? "", preview: null };
    case "tool.completed":
      return { kind: "toolCompleted", runId, at, tool: event.tool ?? "", failed: event.ok === false, seconds: null };
    case "proposal.staged":
      return { kind: "assistantDelta", runId, at, text: `Staged into proposal ${event.group ?? ""}` };
    case "run.completed":
      return { kind: "runCompleted", runId, at, output: event.text ?? "" };
    case "run.failed":
      return { kind: "runFailed", runId, at, error: event.error ?? event.text ?? "The run failed." };
    case "run.cancelled":
      return { kind: "runCancelled", runId, at };
    default:
      return null;
  }
}

/** The frames of one SSE chunk: `event:` name and parsed `data:` payload. */
export function parseSseFrames(chunk: string): { readonly event: string; readonly data: unknown }[] {
  const frames: { event: string; data: unknown }[] = [];
  for (const block of chunk.split("\n\n")) {
    if (block.trim() === "") continue;
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      else if (line.startsWith("data:")) data.push(line.slice("data:".length).trim());
    }
    let parsed: unknown = null;
    try {
      parsed = data.length === 0 ? null : (JSON.parse(data.join("\n")) as unknown);
    } catch {
      parsed = null;
    }
    frames.push({ event, data: parsed });
  }
  return frames;
}

/**
 * Follows a run's stream: the bridge answers the buffered history first and
 * then live events until the run ends. `onEvent` sees every event the contract
 * recognises; the promise settles when the stream ends or `idleMs` passes
 * with nothing arriving, whichever comes first — a poll wants the history and
 * leaves, a follower wants the end.
 */
export async function followBridgeEvents(
  runId: string,
  onEvent: (event: RunEvent) => Promise<void> | void,
  options: { readonly idleMs?: number; readonly signal?: AbortSignal } = {},
): Promise<BridgeReply<"ended" | "idle">> {
  const controller = new AbortController();
  options.signal?.addEventListener("abort", () => controller.abort());
  // The stream is read as the person whose browser asked, exactly as `ask`
  // reads every other bridge verb: the kernel's prod listener admits no
  // session-less request, so a stream opened without the cookie is refused
  // and the run's own events — the reason it failed among them — never reach
  // the reader. This call cannot go through `ask` because it needs the body
  // unread. BO_0209_002
  const headers = new Headers({ accept: "text/event-stream" });
  const cookie = forwardedCookie();
  if (cookie !== undefined) headers.set("cookie", cookie);
  let response: Response;
  try {
    response = await fetch(`${base()}/runs/${encodeURIComponent(runId)}/events`, {
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    return { ok: false, status: 503, detail: `The kernel could not be reached: ${String(error)}` };
  }
  if (!response.ok || response.body === null) {
    return { ok: false, status: response.status, detail: `The kernel answered ${response.status} for the run's events.` };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const idleMs = options.idleMs;
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const idle = new Promise<"idle">((resolve) => {
      if (idleMs !== undefined) timer = setTimeout(() => resolve("idle"), idleMs);
    });
    const next = await Promise.race([reader.read(), idle]);
    if (timer !== undefined) clearTimeout(timer);
    if (next === "idle") {
      controller.abort();
      return { ok: true, value: "idle" };
    }
    if (next.done) {
      return { ok: true, value: "ended" };
    }
    buffer += decoder.decode(next.value, { stream: true });
    const cut = buffer.lastIndexOf("\n\n");
    if (cut < 0) continue;
    const complete = buffer.slice(0, cut + 2);
    buffer = buffer.slice(cut + 2);
    for (const frame of parseSseFrames(complete)) {
      if (frame.event === "end") {
        controller.abort();
        return { ok: true, value: "ended" };
      }
      const event = translateBridgeEvent(runId, (frame.data ?? { type: frame.event, at: 0 }) as BridgeEvent);
      if (event !== null) await onEvent(event);
    }
  }
}
