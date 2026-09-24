import { refusal, respond, type OutcomeResponse } from "~/server/outcome";
import { withBranch } from "~/server/ccgw/branch-scope";

import { addWork, retireWork, reviseWork } from "./works";

/**
 * This extension's command route (`BO_0291_016`), its own rather than
 * `documents`' single switch, as `relations`' is: the extension owns the
 * `work` vocabulary, so it owns the writes of it, and the branch scope is the
 * shared helper either way.
 */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

async function decode(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export type WorkCommand =
  | { readonly command: "addWork"; readonly record: unknown }
  | { readonly command: "reviseWork"; readonly workId: string; readonly baseRevisionId: string; readonly record: unknown }
  | { readonly command: "retireWork"; readonly workId: string; readonly baseRevisionId: string };

export function parseWorkCommand(body: unknown): { command: WorkCommand } | { failure: string } {
  const value = record(body);
  if (value === null) return { failure: "a command is an object" };
  const command = text(value["command"]);
  if (command === "addWork") {
    if (record(value["record"]) === null) return { failure: "an addWork command carries a record" };
    return { command: { command: "addWork", record: value["record"] } };
  }
  if (command === "reviseWork" || command === "retireWork") {
    const workId = text(value["workId"]);
    const baseRevisionId = text(value["baseRevisionId"]);
    if (workId === null) return { failure: `a ${command} command names the workId` };
    if (baseRevisionId === null) return { failure: `a ${command} command names the baseRevisionId it read` };
    if (command === "retireWork") return { command: { command, workId, baseRevisionId } };
    if (record(value["record"]) === null) return { failure: "a reviseWork command carries a record" };
    return { command: { command, workId, baseRevisionId, record: value["record"] } };
  }
  return { failure: `${String(value["command"])} is not a command of this extension` };
}

export async function handleWorkCommand(request: Request): Promise<OutcomeResponse<unknown>> {
  const body = await decode(request);
  if (body === undefined) return respond(refusal("requestShape", "body is not JSON."));
  const parsed = parseWorkCommand(body);
  if ("failure" in parsed) return respond(refusal("commandShape", parsed.failure));
  // A command from a tab in a branch names it, and the write stages into it
  // instead of establishing, as `documents`' commands do. BO_0250_011
  const branch = text(record(body)?.["branch"]);
  const command = parsed.command;
  return respond(
    await withBranch(branch ?? undefined, () => {
      switch (command.command) {
        case "addWork":
          return addWork({ record: command.record });
        case "reviseWork":
          return reviseWork({ workId: command.workId, baseRevisionId: command.baseRevisionId, record: command.record });
        case "retireWork":
          return retireWork({ workId: command.workId, baseRevisionId: command.baseRevisionId });
      }
    }),
  );
}
