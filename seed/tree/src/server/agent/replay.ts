import type { ReplayRun } from "~/lib/replay";
import { readBridgeRun, recordedEvents, type BridgeReply, type BridgeRun } from "./bridge";

/**
 * What a replay plays of a finished run, read from the bridge's record
 * (`BO_0340_001`). The record keeps the words the kernel read, the document
 * and block they were sent from, the pin, the group and every event with its
 * time, so nothing here asks the kernel for more than the run's own read.
 * Refusals are said in words and told apart: a run still going, one sent from
 * no block, one the instance no longer holds, and a kernel that could not be
 * reached.
 */
export async function readReplay(runId: string): Promise<BridgeReply<ReplayRun>> {
  const read = await readBridgeRun(runId);
  if (!read.ok) {
    return read.status === 404
      ? { ok: false, status: 404, detail: "This run can no longer be replayed: the instance holds no record of it." }
      : { ok: false, status: read.status, detail: `The run could not be read: ${read.detail}` };
  }
  return replayOf(read.value);
}

/** The replay a record holds, or the reason it holds none. Pure. */
export function replayOf(run: BridgeRun): BridgeReply<ReplayRun> {
  if (run.status !== "completed" && run.status !== "failed" && run.status !== "cancelled") {
    return { ok: false, status: 409, detail: "This run is still going. A run can be replayed once it has ended." };
  }
  if (run.artifact === undefined || run.artifact === "" || run.source === undefined || run.source.block === "") {
    return { ok: false, status: 409, detail: "This run was not sent from a block of a document, so there is no command to type." };
  }
  const events = recordedEvents(run);
  if (events.length === 0) {
    return { ok: false, status: 410, detail: "This run can no longer be replayed: its record holds none of its events." };
  }
  const end = [...events].reverse().find((event) => event.kind === "runFailed" || event.kind === "runCancelled" || event.kind === "runCompleted");
  return {
    ok: true,
    value: {
      runId: run.id,
      words: run.goal,
      document: run.artifact,
      block: run.source.block,
      pin: run.pin,
      group: run.group === undefined || run.group === "" ? null : run.group,
      agent: run.agent ?? null,
      state: run.status,
      reason: end?.kind === "runFailed" ? end.error : end?.kind === "runCancelled" ? "The run was cancelled." : null,
      events,
    },
  };
}
