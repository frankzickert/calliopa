/**
 * The normalized event contract for an agent run.
 *
 * The shell reads these and never Hermes-native JSON. That boundary exists
 * because the events on the other side of it belong to a pinned external
 * distribution: a bump may rename them, add fields, or drop one, and when it
 * does the damage should stop at this file rather than reaching a component
 * that renders a console.
 *
 * The shapes below were read off the pinned release rather than imagined.
 * CA_0022_012
 */

/** Bumped when the meaning of an event changes, not when one is added. */
export const RUN_EVENT_CONTRACT_VERSION = 1;

export type RunEvent =
  | { readonly kind: "runStarted"; readonly runId: string; readonly at: number }
  | {
      readonly kind: "assistantDelta";
      readonly runId: string;
      readonly at: number;
      readonly text: string;
    }
  | {
      readonly kind: "toolStarted";
      readonly runId: string;
      readonly at: number;
      readonly tool: string;
      readonly preview: string | null;
    }
  | {
      readonly kind: "toolCompleted";
      readonly runId: string;
      readonly at: number;
      readonly tool: string;
      readonly failed: boolean;
      readonly seconds: number | null;
    }
  | {
      readonly kind: "runCompleted";
      readonly runId: string;
      readonly at: number;
      readonly output: string;
    }
  | {
      readonly kind: "runFailed";
      readonly runId: string;
      readonly at: number;
      readonly error: string;
    }
  | {
      readonly kind: "runCancelled";
      readonly runId: string;
      readonly at: number;
    };

/**
 * What the translator answers. An event it does not recognise is reported as
 * itself rather than dropped: a pin bump that renames an event would otherwise
 * show up as a run that quietly stopped saying anything, which is the failure
 * mode hardest to notice and hardest to diagnose.
 */
export type TranslatedEvent =
  | { readonly ok: true; readonly event: RunEvent }
  | { readonly ok: false; readonly name: string; readonly detail: string };

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/** Hermes stamps `timestamp` in seconds; the shell works in milliseconds. */
function at(raw: Record<string, unknown>): number {
  const stamp = raw["timestamp"];
  return typeof stamp === "number" ? Math.round(stamp * 1000) : Date.now();
}

/**
 * Translates one Hermes run event into the contract.
 *
 * `reasoning.available` and the approval events are recognised and deliberately
 * carried no further: the first is the model thinking aloud, which the console
 * does not show, and the second belongs to an interactive approval broker this
 * change does not build. They are named here so they are not mistaken for a
 * shape the release started emitting.
 */
export function translateRunEvent(value: unknown): TranslatedEvent {
  const raw = record(value);
  if (raw === null) {
    return { ok: false, name: "", detail: "An event is an object." };
  }

  const name = text(raw["event"]) ?? "";
  const runId = text(raw["run_id"]);
  if (runId === null) {
    return { ok: false, name, detail: "An event names the run it belongs to." };
  }

  switch (name) {
    case "message.delta": {
      const delta = text(raw["delta"]);
      return delta === null
        ? { ok: false, name, detail: "A delta carries text." }
        : { ok: true, event: { kind: "assistantDelta", runId, at: at(raw), text: delta } };
    }

    case "tool.started": {
      const tool = text(raw["tool"]);
      return tool === null
        ? { ok: false, name, detail: "A tool event names its tool." }
        : {
            ok: true,
            event: {
              kind: "toolStarted",
              runId,
              at: at(raw),
              tool,
              preview: text(raw["preview"]),
            },
          };
    }

    case "tool.completed": {
      const tool = text(raw["tool"]);
      const seconds = raw["duration"];
      return tool === null
        ? { ok: false, name, detail: "A tool event names its tool." }
        : {
            ok: true,
            event: {
              kind: "toolCompleted",
              runId,
              at: at(raw),
              tool,
              // The release sends `error` as a boolean flag, not a message.
              failed: raw["error"] === true,
              seconds: typeof seconds === "number" ? seconds : null,
            },
          };
    }

    case "run.completed":
      return {
        ok: true,
        event: {
          kind: "runCompleted",
          runId,
          at: at(raw),
          output: text(raw["output"]) ?? "",
        },
      };

    case "run.failed":
      return {
        ok: true,
        event: {
          kind: "runFailed",
          runId,
          at: at(raw),
          error: text(raw["error"]) ?? "The run failed without saying why.",
        },
      };

    case "run.cancelled":
      return { ok: true, event: { kind: "runCancelled", runId, at: at(raw) } };

    case "reasoning.available":
    case "approval.request":
    case "approval.responded":
      return {
        ok: false,
        name,
        detail: "Known to the release and deliberately not carried.",
      };

    default:
      return { ok: false, name, detail: "No event of this name is translated." };
  }
}

/**
 * The run's own start, which the release does not put on the stream at all: its
 * status moves `queued` to `running` and the first thing the stream carries is
 * whatever the agent did. The lifecycle raises this when the run is accepted,
 * so the console has a beginning to draw.
 */
export function runStarted(runId: string, when = Date.now()): RunEvent {
  return { kind: "runStarted", runId, at: when };
}

/**
 * Reads `data:` payloads out of an SSE chunk. Comment frames — which the
 * release uses for keepalives — carry no event and are skipped, and a frame
 * that is not JSON is answered as unrecognised rather than thrown, because one
 * malformed frame must not end a run's stream.
 */
export function readSseFrames(chunk: string): TranslatedEvent[] {
  const translated: TranslatedEvent[] = [];

  for (const frame of chunk.split("\n\n")) {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");
    if (data === "") {
      continue;
    }
    try {
      translated.push(translateRunEvent(JSON.parse(data)));
    } catch {
      translated.push({
        ok: false,
        name: "",
        detail: "A frame carried something that is not JSON.",
      });
    }
  }

  return translated;
}
