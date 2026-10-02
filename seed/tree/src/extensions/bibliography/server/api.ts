import { refusal, respond, type OutcomeResponse } from "~/server/outcome";
import { withBranch } from "~/server/ccgw/branch-scope";

import { addWork, fillWork } from "./works";

/**
 * This extension's command route (`BO_0291_016`, `BO_0313_020`), its own
 * rather than `documents`' single switch, as `relations`' is: adding a source
 * document and filling one from a fetched record are this extension's; its
 * fields are edited in the inspector and it is deleted as a document. The
 * branch scope is the shared helper either way.
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
  | { readonly command: "fillWork"; readonly workId: string; readonly baseRevisionId: string; readonly record: unknown };

export function parseWorkCommand(body: unknown): { command: WorkCommand } | { failure: string } {
  const value = record(body);
  if (value === null) return { failure: "a command is an object" };
  const command = text(value["command"]);
  if (command === "addWork") {
    if (record(value["record"]) === null) return { failure: "an addWork command carries a record" };
    return { command: { command: "addWork", record: value["record"] } };
  }
  if (command === "fillWork") {
    const workId = text(value["workId"]);
    const baseRevisionId = text(value["baseRevisionId"]);
    if (workId === null) return { failure: "a fillWork command names the workId" };
    if (baseRevisionId === null) return { failure: "a fillWork command names the baseRevisionId it read" };
    if (record(value["record"]) === null) return { failure: "a fillWork command carries a record" };
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
        case "fillWork":
          return fillWork({ workId: command.workId, baseRevisionId: command.baseRevisionId, record: command.record });
      }
    }),
  );
}
