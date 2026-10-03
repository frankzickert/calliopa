import { isRecordId } from "~/server/uuid";

import { isStructureId, shownValue, STRUCTURE_STRUCTURE, type DocumentStructuresView, type TakenStructure } from "../lib/structures";
import { proposeStructures, structuresOf, type Staged } from "./structures";

/**
 * The tools this extension answers a run: `read_document_structures` reads, and
 * `propose_structures` proposes (`BO_0309_016`). Each is an `ext.tool` member the
 * kernel offers while the extension is active and posts a call to through
 * the callback. A proposal lands only when the person accepts it with the
 * run's other proposals (`BO_0308_Q4`, `BO_0309_Q4`): the route composes the
 * statements, and the kernel stages them into the run's group.
 */

/** What the kernel posts a tool: the run's input and the run. */
export interface ToolCall {
  readonly input: Readonly<Record<string, unknown>>;
  readonly run: {
    readonly id: string;
    readonly group: string;
    readonly pin: number;
    readonly person?: string;
    readonly system?: boolean;
  };
}

/** What a tool answers the kernel: the result the run reads, and the
 * statements staged into its group. */
export interface ToolAnswer {
  readonly result: unknown;
  readonly stage?: readonly Staged[];
}

/** A tool refused: the run reads the reason and nothing is staged. */
export class ToolRefusal extends Error {}

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const record = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** The document a call names, as a record id. */
export function documentOfInput(
  input: Readonly<Record<string, unknown>>,
  tool = "read_document_structures",
): string {
  const document = text(input["document"]);
  if (document === "" || !isRecordId(document))
    throw new ToolRefusal(`${tool} needs document, the document's record id`);
  return document;
}

/** What `propose_structures` asks, read from its input, or a refusal naming why. */
export function proposalOfInput(input: Readonly<Record<string, unknown>>): {
  readonly documentId: string;
  readonly blockId?: string;
  readonly take: readonly string[];
  readonly clear: readonly string[];
  readonly values: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
} {
  const documentId = documentOfInput(input, "propose_structures");
  const block = text(input["block"]);
  if (block !== "" && !isRecordId(block))
    throw new ToolRefusal("propose_structures names block by its record id, or leaves it out for the document's own structures");
  const ids = (key: string): string[] => {
    const value = input[key];
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.every((id) => typeof id === "string" && isStructureId(id)))
      throw new ToolRefusal(`propose_structures takes ${key} as a list of structure ids`);
    return value as string[];
  };
  const values: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [structure, entries] of Object.entries(record(input["values"]))) {
    if (!isStructureId(structure)) throw new ToolRefusal(`propose_structures takes values by structure id; ${structure} is not one`);
    values[structure] = record(entries);
  }
  const take = ids("use");
  const clear = ids("clear");
  if (take.length === 0 && clear.length === 0 && Object.keys(values).length === 0)
    throw new ToolRefusal("propose_structures proposes something: use, clear or values");
  return { documentId, ...(block === "" ? {} : { blockId: block }), take, clear, values };
}

const refusalOf = (read: { outcome: string } & Record<string, unknown>): string =>
  read.outcome === "validationFailure"
    ? ((read["failures"] as readonly { detail: string }[] | undefined) ?? []).map((failure) => failure.detail).join(" ")
    : `the structures could not be read: ${read.outcome}`;

/** A taken structure as a run reads it: the values by field name. */
const forRun = (structure: TakenStructure) => ({
  id: structure.id,
  name: structure.name,
  // A run reads a structure's whole text (RO_0005_Q8).
  description: structure.text ?? structure.description,
  ...(structure.builtin ? { builtin: true } : {}),
  ...(structure.retired ? { retired: true } : {}),
  ...(structure.offered ? {} : { offered: false }),
  ...(structure.blocks ? {} : { documentOnly: true }),
  ...(structure.notOnBlock === true ? { notOnBlock: true } : {}),
  fields: structure.fields.map((field) => ({
    key: field.key,
    name: field.name,
    type: field.type,
    ...(field.required ? { required: true } : {}),
    ...(field.options === undefined ? {} : { options: field.options }),
    value: shownValue(field, structure.values[field.key]),
  })),
  ...(structure.missing.length === 0 ? {} : { missing: structure.missing }),
});

/**
 * read_document_structures: the document's own structures and each block's, with their
 * values and what each may take, at the run's pin — what the person
 * established, never a candidate's.
 */
export async function readDocumentStructures(call: ToolCall): Promise<ToolAnswer> {
  const document = documentOfInput(call.input);
  // At the run's pin through its group, as the shell's scope reads. BO_0344_005
  const read = await structuresOf(document);
  if (read.outcome !== "success") throw new ToolRefusal(refusalOf(read as never));
  const view: DocumentStructuresView = read.result;
  const named = view.structures.map((structure) => structure.name).join(", ");
  return {
    result: {
      documentId: view.documentId,
      dataRevision: view.dataRevision,
      structures: view.structures.map(forRun),
      ...(view.inherited.length === 0
        ? {}
        : { inherited: view.inherited.map((structure) => ({ id: structure.id, name: structure.name, description: structure.description, on: structure.on, document: structure.document })) }),
      usable: view.takeable,
      blocks: view.blocks.map((block) => ({
        blockId: block.blockId,
        kind: block.kind,
        ...(block.parentId === null ? {} : { parentId: block.parentId }),
        structures: block.structures.map(forRun),
        usable: block.takeable,
      })),
      note: [
        view.inherited.length === 0
          ? ""
          : `This document is the focused work of a block using ${[...new Set(view.inherited.map((structure) => structure.name))].join(", ")}: those structures stand above it, so write it as part of them, and its blocks can take the structures they offer. `,
        view.structures.length === 0 && view.blocks.every((block) => block.structures.length === 0)
          ? view.inherited.length === 0
            ? "Nothing here uses a structure; write it as you would any document."
            : "Nothing here uses a structure of its own yet. To give a block a structure, or a field a value, call propose_structures; it lands only when the person accepts it."
          : `${named === "" ? "Blocks here use structures" : `This document is a ${named}`}: write each block by its structures. To give a block or the document a structure, or a field a value, call propose_structures; it lands only when the person accepts it.`,
        // A structure is itself a document (RO_0005_005).
        view.structures.some((structure) => structure.id === STRUCTURE_STRUCTURE)
          ? " This document is a structure: its title names it, its other blocks describe it, and each block using Field is one of its fields, declared by Field's values."
          : "",
      ].join(""),
    },
  };
}

/**
 * propose_structures: structures to take and clear and values to store on one block,
 * or on the document when no block is named, staged into the run's group
 * for the person to accept (`BO_0309_016`). Refused in words where the
 * person's own act would be: a structure the block cannot take where it stands, a
 * value for a structure it does not take, a value not of its field's type.
 */
export async function proposeStructuresTool(call: ToolCall): Promise<ToolAnswer> {
  const proposal = proposalOfInput(call.input);
  const staged = await proposeStructures(proposal);
  if (staged.outcome !== "success") throw new ToolRefusal(refusalOf(staged as never));
  return {
    result: {
      staged: staged.result.length,
      note:
        staged.result.length === 0
          ? "Nothing to propose: what you asked for already stands."
          : "Proposed. It stands only once the person accepts it with your other proposals.",
    },
    stage: staged.result,
  };
}

export const TOOLS = {
  read_document_structures: readDocumentStructures,
  propose_structures: proposeStructuresTool,
} as const;
