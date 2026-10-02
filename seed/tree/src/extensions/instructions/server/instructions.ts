import { HttpError } from "~/server/http-error";
import type { GraphOutcome } from "~/server/outcome";
import { isRecordId } from "~/server/uuid";
import { call } from "~/server/kernel/client";
import { nodeRef } from "~/server/ccgw/nodes";
import { INSTRUCTION_RECORD } from "~/extensions/documents/lib/instruction";
import { UNNAMED_INSTRUCTION } from "~/extensions/documents/lib/naming";
import { clearProfileSlotsStatement, createDocument, listInstructions, instructionSummary, moveInstructionRecordsStatement } from "~/extensions/documents/server/documents";
import { documentsCarrying, structuresOf, setStructure } from "~/extensions/structures/server/structures";
import { HAS_BLOCK_STRUCTURE } from "~/extensions/structures/lib/structures";

import { INSTRUCTION_STRUCTURE, type InstructionChoices } from "../lib/instructions";

/**
 * What `instructions`' routes are made of (`calliopa-bootstrap`'s `BO_0311`):
 * the create, the chip's choices, the kernel's grant forwarded, and the
 * upgrade migration. Only server code imports this module.
 */

export const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

export const documentOf = (id: string | undefined): string => {
  if (id === undefined || !isRecordId(id)) throw new HttpError(404, "no such document");
  return id;
};

/** What the kernel answers, as the route answers it: its body and status, a
 * refusal as `{error}` in the kernel's own words. */
export async function forward(path: string, init: RequestInit): Promise<{ readonly status: number; readonly body: unknown }> {
  const response = await call(path, init);
  const body = await response.json().catch(() => ({}));
  if (response.ok) return { status: response.status, body };
  const said = (record(body)["diagnostics"] as readonly { readonly message?: string }[] | undefined)?.[0]?.message;
  return { status: response.status, body: { error: said ?? `the kernel answered ${response.status}` } };
}

/** The instruction the person last sent with in the document, or null. */
async function lastInstruction(documentId: string): Promise<string | null> {
  const response = await call(`/__kernel/state/people/me/instruction/${encodeURIComponent(documentId)}`, { method: "GET" });
  if (!response.ok) return null;
  const body = record(await response.json().catch(() => ({})));
  return typeof body["instruction"] === "string" ? body["instruction"] : null;
}

/**
 * What the chip offers on a block (`BO_0311_011`): every instruction by title,
 * those carrying a role the block or its document takes marked to be grouped
 * first, and the instruction the person last sent with here — none on an instruction
 * document's own chip, which starts at *No instruction* (`BO_0298_Q9`).
 */
export async function choicesFor(documentId: string, blockId: string): Promise<GraphOutcome<InstructionChoices>> {
  const [listed, own, roles] = await Promise.all([listInstructions(), instructionSummary(documentId), structuresOf(documentId)]);
  if (listed.outcome !== "success") return listed as GraphOutcome<never>;
  if (own.outcome !== "success") return own as GraphOutcome<never>;
  const taken = new Set<string>();
  if (roles.outcome === "success") {
    for (const role of roles.result.structures) taken.add(role.id);
    for (const role of roles.result.blocks.find((block) => block.blockId === blockId)?.structures ?? []) taken.add(role.id);
  }
  taken.delete(INSTRUCTION_STRUCTURE);
  const matching = new Set<string>();
  for (const role of taken) {
    const carrying = await documentsCarrying(role);
    if (carrying.outcome === "success") for (const document of carrying.result) matching.add(document.id);
  }
  const isInstruction = own.result !== null;
  return {
    outcome: "success",
    result: {
      reachable: true,
      isInstruction,
      instructions: listed.result.map((instruction) => ({ ...instruction, matches: matching.has(instruction.id) })),
      last: isInstruction ? null : await lastInstruction(documentId),
    },
  };
}

/**
 * The migration `BO_0311_010` and `BO_0311_020` take on upgrade (`BO_0311_Q1`):
 * every instruction takes *Instruction* where it does not, and every document's
 * attached instruction is dropped, so every chip starts at *No instruction*. One
 * script, or an empty one once both stand. Idempotent.
 */
export async function instructionInTheChip(): Promise<GraphOutcome<{ statement: string; parameters: Record<string, unknown>; rationale: string }>> {
  const [listed, carrying, slots] = await Promise.all([listInstructions(), documentsCarrying(INSTRUCTION_STRUCTURE), clearProfileSlotsStatement()]);
  if (listed.outcome !== "success") return listed as GraphOutcome<never>;
  if (carrying.outcome !== "success") return carrying as GraphOutcome<never>;
  if (slots.outcome !== "success") return slots as GraphOutcome<never>;
  const holding = new Set(carrying.result.map((document) => document.id));
  const statements: string[] = slots.result.statement === "" ? [] : [slots.result.statement];
  const parameters: Record<string, unknown> = { ...slots.result.parameters };
  listed.result
    .filter((instruction) => !holding.has(instruction.id))
    .forEach((instruction, index) => {
      parameters[`r${index}from`] = nodeRef(instruction.id);
      parameters[`r${index}to`] = nodeRef(INSTRUCTION_STRUCTURE);
      statements.push(`RELATE r${index}from -[r${index}:${HAS_BLOCK_STRUCTURE}]-> r${index}to`);
    });
  return { outcome: "success", result: { statement: statements.join("; "), parameters, rationale: "every instruction takes Instruction, and no document keeps an attached instruction" } };
}

/**
 * The migration `BO_0311_015` takes on upgrade: every document carrying
 * *Instruction* without `record: instruction` — given the role from its chip before
 * taking the role wrote the record — takes the record, so the chip, the run
 * start and the grant read it as the instruction it is. One script, or an empty
 * one once every carrier holds it. Idempotent.
 */
export async function instructionRecord(): ReturnType<typeof instructionInTheChip> {
  const [listed, carrying] = await Promise.all([listInstructions(), documentsCarrying(INSTRUCTION_STRUCTURE)]);
  if (listed.outcome !== "success") return listed as GraphOutcome<never>;
  if (carrying.outcome !== "success") return carrying as GraphOutcome<never>;
  const recorded = new Set(listed.result.map((instruction) => instruction.id));
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  carrying.result
    .filter((document) => !recorded.has(document.id))
    .forEach((document, index) => {
      parameters[`p${index}NodeId`] = nodeRef(document.id);
      parameters[`p${index}_record`] = INSTRUCTION_RECORD;
      statements.push(`SET p${index}.record = $p${index}_record`);
    });
  return { outcome: "success", result: { statement: statements.join("; "), parameters, rationale: "every document carrying Instruction is an instruction" } };
}

/**
 * The migration `BO_0338` takes on upgrade: every instruction kept as a
 * profile carries `record: instruction`, and one still titled as an unnamed
 * profile is titled as an unnamed instruction. One script, or an empty one
 * once none is left. Idempotent. The two before it keep their routes, which
 * every instance records them run by.
 */
export async function instructionsFromProfiles(): ReturnType<typeof instructionInTheChip> {
  const moved = await moveInstructionRecordsStatement();
  if (moved.outcome !== "success") return moved as GraphOutcome<never>;
  return { outcome: "success", result: { ...moved.result, rationale: "every profile is an instruction" } };
}

export const MIGRATIONS: Readonly<Record<string, () => ReturnType<typeof instructionInTheChip>>> = {
  "profile-in-the-chip": instructionInTheChip,
  "profile-record": instructionRecord,
  "instructions-from-profiles": instructionsFromProfiles,
};

/** A new instruction: a document carrying the record, with one empty block,
 * named as a new document is and renamed in the editor, taking the built-in
 * *Instruction* so the Roles category lists it. BO_0298_014 BO_0311_010 */
export async function createInstruction(title: string): ReturnType<typeof createDocument> {
  const created = await createDocument({ title: title.trim() === "" ? UNNAMED_INSTRUCTION : title, record: INSTRUCTION_RECORD });
  if (created.outcome === "success") await setStructure({ documentId: created.result.documentId, structure: INSTRUCTION_STRUCTURE, taken: true });
  return created;
}

