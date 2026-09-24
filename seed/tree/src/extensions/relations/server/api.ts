import { readRuns } from "~/lib/runs";
import { refusal, respond, type OutcomeResponse } from "~/server/outcome";
import { withBranch } from "~/server/ccgw/branch-scope";

import { isRelationKind, isRelationOrigin, type RelationInput } from "../lib/relation";
import { declareRelation } from "./relations";

/**
 * This extension's command route (`BO_0288_017`). It is its own rather than
 * `documents`' single switch: the extension owns the vocabulary, so it owns
 * the writes of it, and the branch scope is the shared helper either way so a
 * second route costs nothing.
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

/** One end of a relation: a block by identity, and nothing else. */
function readEnd(value: unknown, which: string): { readonly blockId: string } | { readonly failure: string } {
  const end = record(value);
  const blockId = end === null ? null : text(end["blockId"]);
  if (blockId === null) return { failure: `the ${which} of a relation names a blockId` };
  return { blockId };
}

export type RelationCommand = { readonly command: "declareRelation"; readonly relation: RelationInput };

export function parseRelationCommand(body: unknown): { command: RelationCommand } | { failure: string } {
  const value = record(body);
  if (value === null) return { failure: "a command is an object" };
  if (text(value["command"]) !== "declareRelation") {
    return { failure: `${String(value["command"])} is not a command of this extension` };
  }
  const relation = record(value["relation"]);
  if (relation === null) return { failure: "a declareRelation command carries a relation" };
  const kind = relation["kind"];
  if (!isRelationKind(kind)) return { failure: `${String(kind)} is not a relation kind` };
  const origin = relation["origin"];
  if (origin !== undefined && !isRelationOrigin(origin)) return { failure: `${String(origin)} is not a relation origin` };
  const reason = readRuns(relation["reason"]);
  if ("failure" in reason) return { failure: `a relation gives its reason as runs: ${reason.failure}` };
  if (reason.runs.length === 0) return { failure: "a relation gives its reason: the condition that connects its ends" };
  const source = readEnd(relation["source"], "source");
  if ("failure" in source) return source;
  const target = readEnd(relation["target"], "target");
  if ("failure" in target) return target;
  return {
    command: {
      command: "declareRelation",
      relation: { kind, reason: reason.runs, ...(origin === undefined ? {} : { origin }), source, target },
    },
  };
}

export async function handleRelationCommand(request: Request): Promise<OutcomeResponse<unknown>> {
  const body = await decode(request);
  if (body === undefined) return respond(refusal("requestShape", "body is not JSON."));
  const parsed = parseRelationCommand(body);
  if ("failure" in parsed) return respond(refusal("commandShape", parsed.failure));
  // A command from a tab in a branch names it, and the write stages into it
  // instead of establishing, as `documents`' commands do. BO_0250_011
  const branch = text(record(body)?.["branch"]);
  return respond(await withBranch(branch ?? undefined, () => declareRelation({ relation: parsed.command.relation })));
}
