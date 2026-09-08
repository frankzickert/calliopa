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
 * is named; the context tells the run where it was asked from.
 */
export function startBridgeRun(input: {
  readonly goal: string;
  readonly context?: string;
  readonly agent?: string;
}): Promise<BridgeReply<BridgeRun>> {
  return ask(
    "/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: input.goal,
        context: input.context ?? "",
        agent: input.agent ?? "",
      }),
    },
    (body) => (body as { run: BridgeRun }).run,
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
  let response: Response;
  try {
    response = await fetch(`${base()}/runs/${encodeURIComponent(runId)}/events`, {
      headers: { accept: "text/event-stream" },
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
