import { randomUUID } from "node:crypto";

import type { GraphOutcome } from "~/server/outcome";
import type { BindingView } from "../lib/work";
import { commit, commitEach, matching, nodesOfType, number, properties, read, refuse, revise, text } from "./graph";
import { stateAt } from "./releases";
import { BINDING_TYPE, fieldValueRefusal, type FieldFacts } from "./vocabulary";

/**
 * A binding: what one record is worth at one channel, as authored — its
 * address, its number, the container's field values and the disclosure.
 * Keyed by record and channel by a read before the write, since the graph
 * validates one node at a time. Observed facts are never stored here; they
 * are the log's. PU_0003_003
 */

const ADDRESS = /^[a-z0-9-]+$/u;

export function bindingOf(content: Record<string, unknown>, bindingId: string | null, recordId: string, recordKind: "deliverable" | "item", channel: string, settled: boolean): BindingView {
  const fields = content["fields"];
  return {
    bindingId,
    recordId,
    recordKind,
    channel,
    address: text(content, "address") || null,
    number: number(content, "number"),
    fields: typeof fields === "object" && fields !== null && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {},
    disclosure: typeof content["disclosure"] === "boolean" ? (content["disclosure"] as boolean) : null,
    addressSettled: settled,
  };
}

/** The binding of a record at a channel, or an empty one that says the address may still change. */
export async function readBinding(recordId: string, recordKind: "deliverable" | "item", channel: string): Promise<GraphOutcome<BindingView>> {
  const [outcome, state] = await Promise.all([matching(BINDING_TYPE, { recordId, channel }, "binding read"), stateAt(recordId, channel)]);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<BindingView>;
  if (state.outcome !== "success") return state as GraphOutcome<BindingView>;
  const settled = state.result.firstPublishedAt !== null;
  const node = nodesOfType(outcome.result, BINDING_TYPE)[0];
  if (node === undefined) return { outcome: "success", result: bindingOf({}, null, recordId, recordKind, channel, settled) };
  const own = read(node);
  return { outcome: "success", result: bindingOf(own.content, own.id, recordId, recordKind, channel, settled) };
}

export interface BindingInput {
  readonly address?: string | null | undefined;
  readonly number?: number | null | undefined;
  readonly fields?: Readonly<Record<string, unknown>> | undefined;
  readonly disclosure?: boolean | null | undefined;
}

/**
 * Writes a binding: a first one is created, a later one revised, a value
 * omitted left as it stands and an explicit null cleared. The address is
 * refused once the record was ever published at the channel, naming the
 * remedy; a field's value is refused against its type.
 */
export async function writeBinding(input: {
  readonly recordId: string;
  readonly recordKind: "deliverable" | "item";
  readonly channel: string;
  readonly fieldFacts: readonly FieldFacts[];
  readonly values: BindingInput;
}): Promise<GraphOutcome<BindingView>> {
  const existing = await readBinding(input.recordId, input.recordKind, input.channel);
  if (existing.outcome !== "success") return existing;
  const held = existing.result;
  if (input.values.address !== undefined && input.values.address !== null) {
    const address = input.values.address.trim();
    if (!ADDRESS.test(address)) return refuse("addressShape", "An address is lowercase letters, digits and hyphens.");
    if (held.addressSettled && address !== held.address) {
      return refuse("addressSettled", `This record was published at ${held.address ?? "its address"}; to move it, retire it there and publish at the new address.`);
    }
  }
  if (input.values.address === null && held.addressSettled) return refuse("addressSettled", "A published record keeps its address.");
  if (input.values.number !== undefined && input.values.number !== null && (!Number.isInteger(input.values.number) || input.values.number < 1)) {
    return refuse("numberShape", "A number is a whole number from 1.");
  }
  const fields: Record<string, unknown> = { ...held.fields };
  if (input.values.fields !== undefined) {
    for (const [key, value] of Object.entries(input.values.fields)) {
      const facts = input.fieldFacts.find((field) => field.key === key);
      if (facts === undefined) return refuse("unknownField", `The container declares no field ${key}.`);
      const wrong = fieldValueRefusal(facts, value);
      if (wrong !== null) return refuse("fieldValue", wrong);
      if (value === null || value === "" || value === undefined) delete fields[key];
      else fields[key] = value;
    }
  }
  const next = {
    address: input.values.address === undefined ? held.address : input.values.address === null ? null : input.values.address.trim(),
    number: input.values.number === undefined ? held.number : input.values.number,
    fields,
    disclosure: input.values.disclosure === undefined ? held.disclosure : input.values.disclosure,
  };
  if (held.bindingId === null) {
    const bindingId = randomUUID();
    const parameters: Record<string, unknown> = {};
    const content: Record<string, unknown> = {
      id: bindingId,
      recordId: input.recordId,
      recordKind: input.recordKind,
      channel: input.channel,
      fields: next.fields,
      ...(next.address === null ? {} : { address: next.address }),
      ...(next.number === null ? {} : { number: next.number }),
      ...(next.disclosure === null ? {} : { disclosure: next.disclosure }),
    };
    const statement = `CREATE (b:${BINDING_TYPE} {${properties("b", content, parameters)}})`;
    const written = await commit(statement, parameters, `bind ${input.recordId} at ${input.channel}`, async () => bindingId);
    if (written.outcome !== "success") return written as GraphOutcome<BindingView>;
    return readBinding(input.recordId, input.recordKind, input.channel);
  }
  const parameters: Record<string, unknown> = {};
  const statements = revise(
    "b",
    held.bindingId,
    { address: next.address, number: next.number, fields: next.fields, disclosure: next.disclosure },
    { address: held.address ?? undefined, number: held.number ?? undefined, fields: held.fields, disclosure: held.disclosure ?? undefined },
    parameters,
  );
  if (statements.length === 0) return existing;
  const written = await commitEach(statements, parameters, `revise binding of ${input.recordId} at ${input.channel}`, async () => held.bindingId);
  if (written.outcome !== "success") return written as GraphOutcome<BindingView>;
  return readBinding(input.recordId, input.recordKind, input.channel);
}
