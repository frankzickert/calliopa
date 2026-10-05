import { port } from "~/server/port";
import { orderBetween } from "~/lib/order";
import { nodeRef } from "~/server/ccgw/nodes";
import { query } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import { INSTRUCTION_RECORD } from "~/extensions/documents/lib/instruction";
import { CONTAINS } from "~/extensions/documents/server/assemble";
import { HAS_BLOCK_STRUCTURE } from "~/extensions/structures/lib/structures";

import { BUILTIN_INSTRUCTIONS, INSTRUCTION_STRUCTURE } from "../lib/instructions";

/** One script and its parameters, empty when there is nothing to do. */
export interface BuiltinStatement {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
  readonly rationale: string;
}

/**
 * The script that makes the built-in instructions an instance does not hold
 * (`calliopa-bootstrap`'s `BO_0349_033`): each a document under its fixed id,
 * titled by the release, carrying `record: instruction`, its words one block
 * each, using *Instruction*. One already standing — or deleted by a person —
 * is left as it is. Pure: `standing` names the ids the instance holds, and
 * `mint` the new blocks' ids.
 */
export function builtinInstructionsStatement(
  standing: ReadonlySet<string>,
  mint: () => string = () => port.uuid(),
): BuiltinStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  BUILTIN_INSTRUCTIONS.forEach((release, index) => {
    if (standing.has(release.id)) return;
    const d = `i${index}`;
    parameters[`${d}_id`] = release.id;
    parameters[`${d}_title`] = release.title;
    parameters[`${d}_record`] = INSTRUCTION_RECORD;
    parameters[`${d}ref`] = nodeRef(release.id);
    parameters[`${d}s`] = nodeRef(INSTRUCTION_STRUCTURE);
    statements.push(`CREATE (${d}:document {id: $${d}_id, title: $${d}_title, record: $${d}_record, status: "established"})`);
    let order = "";
    release.words.forEach((words, at) => {
      const b = `${d}b${at}`;
      order = orderBetween(order, "");
      const id = mint();
      parameters[`${b}_id`] = id;
      parameters[`${b}_order`] = order;
      parameters[`${b}_runs`] = [{ text: words }];
      parameters[`${b}ref`] = nodeRef(id);
      statements.push(
        `CREATE (${b}:text {id: $${b}_id, order: $${b}_order, runs: $${b}_runs, status: "established"})`,
        `RELATE ${d}ref -[${b}c:${CONTAINS}]-> ${b}ref`,
      );
    });
    statements.push(`RELATE ${d}ref -[${d}h:${HAS_BLOCK_STRUCTURE}]-> ${d}s`);
  });
  return {
    statement: statements.join("; "),
    parameters,
    rationale: "the built-in instructions the release makes, where the instance holds none",
  };
}

/** The ids of the built-in instructions the instance already holds. The
 * migration runs once per instance, as it serves the pin carrying it, so a
 * built-in made then is never made again. */
export async function standingBuiltins(): Promise<GraphOutcome<ReadonlySet<string>>> {
  const standing = new Set<string>();
  for (const release of BUILTIN_INSTRUCTIONS) {
    const found = await query({
      statement: "MATCH (n {id: $id}) RETURN GRAPH n",
      parameters: { id: release.id },
      metadataOnly: true,
      purpose: "a built-in instruction",
    });
    if (found.outcome !== "success" && found.outcome !== "noResult") return found as GraphOutcome<never>;
    if (found.outcome === "success" && found.result.nodes.some((node) => node.id === nodeRef(release.id))) standing.add(release.id);
  }
  return { outcome: "success", result: standing };
}

/** The migration `builtin-instructions` (`BO_0349_033`). */
export async function builtinInstructions(): Promise<GraphOutcome<BuiltinStatement>> {
  const standing = await standingBuiltins();
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  return { outcome: "success", result: builtinInstructionsStatement(standing.result) };
}

/**
 * Why a built-in instruction is never deleted (`calliopa-bootstrap`'s
 * `BO_0349_035`): the drops that start work run under it, so it stands on
 * every instance as the release made it, revised like any instruction but
 * never gone. `documents`' guard refuses deleting it, and a run's removal of
 * it is refused as it is accepted. Nothing for any other document.
 */
export function builtinGuard(documentId: string): { readonly undeletable?: string; readonly blocks: Readonly<Record<string, string>> } {
  const release = BUILTIN_INSTRUCTIONS.find((each) => each.id === documentId);
  return release === undefined
    ? { blocks: {} }
    : { undeletable: `${release.title} is built in: the drops that start work run under it, so revise it rather than deleting it.`, blocks: {} };
}

