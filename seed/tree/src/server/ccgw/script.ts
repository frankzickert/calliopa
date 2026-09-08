import { bareId, nodeRef } from "../documents/assemble";
import type { GraphOutcome } from "../outcome";
import { query, write, type ReadResult } from "./client";

/**
 * The shell's shared shapes over CCGW and the bridge: how a module reads by
 * type or by property, and how it turns one gesture into one `write` script.
 * Documents, production and publishing all write the same way — `CREATE`
 * with a minted id and `status: "established"`, `SET` and `REMOVE`, `RELATE`,
 * `CLOSE`, `RETIRE` — so the statement text is built here once and each
 * module keeps only what its gestures mean. `BO_0207_019`, `BO_0207_020`
 */

export const EMPTY: ReadResult = { roots: [], nodes: [], relations: [], resolvedDataRevision: 0 };

/** Every established node of one type. */
export async function allOfType(semanticType: string, purpose = "listing"): Promise<GraphOutcome<ReadResult>> {
  return matching(semanticType, {}, purpose);
}

/**
 * The established nodes of one type whose properties equal the given values.
 * CCGW's `WHERE` takes equalities joined by `AND` and nothing else, which is
 * what a keyed read needs: a binding by record and channel, a front by
 * channel, the log by record and channel.
 */
export async function matching(
  semanticType: string,
  where: Record<string, unknown>,
  purpose = "keyed read",
): Promise<GraphOutcome<ReadResult>> {
  const parameters: Record<string, unknown> = {};
  const conditions: string[] = [];
  for (const [key, value] of Object.entries(where)) {
    parameters[`w_${key}`] = value;
    conditions.push(`n.${key} = $w_${key}`);
  }
  const outcome = await query({
    statement: `MATCH (n:${semanticType})${conditions.length === 0 ? "" : ` WHERE ${conditions.join(" AND ")}`} RETURN GRAPH n`,
    parameters,
    unbounded: true,
    purpose,
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: EMPTY };
  return outcome;
}

/** One node by identity, with nothing else. */
export async function one(id: string, purpose = "read"): Promise<GraphOutcome<ReadResult>> {
  const outcome = await query({
    statement: "MATCH (n {id: $id}) RETURN GRAPH n",
    parameters: { id: bareId(id) },
    purpose,
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: EMPTY };
  return outcome;
}

/** The revision a node carries at a data revision, read back after a write. */
export async function revisionAt(id: string, dataRevision: string): Promise<string> {
  const outcome = await query({
    statement: "MATCH (n {id: $id}) RETURN GRAPH n",
    parameters: { id: bareId(id) },
    dataRevision: Number(dataRevision),
    purpose: "revision after write",
  });
  if (outcome.outcome !== "success") return "";
  return outcome.result.nodes.find((node) => node.id === nodeRef(id))?.revision.id ?? "";
}

/**
 * Runs one content truth script and shapes its result. The bridge answers
 * the data revision alone; `revisionOf` reads a node's revision at that pin.
 */
export async function commit<T>(
  statement: string,
  parameters: Record<string, unknown>,
  rationale: string,
  result: (dataRevision: string, revisionOf: (id: string) => Promise<string>) => Promise<T>,
): Promise<GraphOutcome<T>> {
  const written = await write(statement, parameters, rationale);
  if (written.outcome !== "success") return written as GraphOutcome<T>;
  const dataRevision = written.result.dataRevision;
  return { outcome: "success", result: await result(dataRevision, (id) => revisionAt(id, dataRevision)) };
}

/**
 * Runs statements that each revise the same node, one write after another.
 *
 * CCGW establishes one revision per node per mutation, so a `SET` and a
 * `REMOVE` on one node cannot travel in one script; the kernel's per-node
 * floor then refuses the second within 250ms of the first, and this waits
 * that floor out once rather than answering a revise that half landed. Every
 * other gesture stays one script, and a refusal of it leaves the graph as it
 * was.
 */
export async function commitEach<T>(
  statements: readonly string[],
  parameters: Record<string, unknown>,
  rationale: string,
  result: (dataRevision: string, revisionOf: (id: string) => Promise<string>) => Promise<T>,
): Promise<GraphOutcome<T>> {
  let dataRevision = "";
  for (const [index, statement] of statements.entries()) {
    let written = await write(statement, parameters, rationale);
    if (index > 0 && written.outcome === "validationFailure" && written.failures[0].rule === "write_too_frequent") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      written = await write(statement, parameters, rationale);
    }
    if (written.outcome !== "success") return written as GraphOutcome<T>;
    dataRevision = written.result.dataRevision;
  }
  const at = dataRevision;
  return { outcome: "success", result: await result(at, (id) => revisionAt(id, at)) };
}

/** The properties a CREATE writes, as statement text over named parameters. */
export function properties(alias: string, content: Record<string, unknown>, parameters: Record<string, unknown>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (value === undefined || value === null) continue;
    const name = `${alias}_${key}`;
    parameters[name] = value;
    pairs.push(`${key}: $${name}`);
  }
  pairs.push(`status: "established"`);
  return pairs.join(", ");
}

/** The assignments a SET writes. */
export function assignments(alias: string, content: Record<string, unknown>, parameters: Record<string, unknown>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (value === undefined) continue;
    const name = `${alias}_${key}`;
    parameters[name] = value;
    pairs.push(`${alias}.${key} = $${name}`);
  }
  return pairs.join(", ");
}

/**
 * The statements that take one node from what it holds to what it should
 * hold: one `SET` for every value given, one `REMOVE` per property cleared
 * (`null`) that the node carries, nothing for a property left as it stands
 * (`undefined`). The node's alias resolves through `<alias>NodeId`.
 */
export function revise(
  alias: string,
  nodeId: string,
  next: Record<string, unknown>,
  held: Record<string, unknown>,
  parameters: Record<string, unknown>,
): string[] {
  parameters[`${alias}NodeId`] = nodeRef(nodeId);
  const set: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (value === null) {
      if (held[key] !== undefined && held[key] !== null) removed.push(key);
    } else if (JSON.stringify(held[key]) !== JSON.stringify(value)) {
      set[key] = value;
    }
  }
  const statements: string[] = [];
  if (Object.keys(set).length > 0) statements.push(`SET ${assignments(alias, set, parameters)}`);
  for (const key of removed) statements.push(`REMOVE ${alias}.${key}`);
  return statements;
}
