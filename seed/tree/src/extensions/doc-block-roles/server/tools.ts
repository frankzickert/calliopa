import { isRecordId } from "~/server/uuid";

import { isRoleId, shownValue, type DocumentRolesView, type TakenRole } from "../lib/roles";
import { proposeRoles, rolesOf, type Staged } from "./roles";

/**
 * The tools this extension answers a run: `read_document_roles` reads, and
 * `propose_roles` proposes (`BO_0309_016`). Each is an `ext.tool` member the
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
  tool = "read_document_roles",
): string {
  const document = text(input["document"]);
  if (document === "" || !isRecordId(document))
    throw new ToolRefusal(`${tool} needs document, the document's record id`);
  return document;
}

/** What `propose_roles` asks, read from its input, or a refusal naming why. */
export function proposalOfInput(input: Readonly<Record<string, unknown>>): {
  readonly documentId: string;
  readonly blockId?: string;
  readonly take: readonly string[];
  readonly clear: readonly string[];
  readonly values: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
} {
  const documentId = documentOfInput(input, "propose_roles");
  const block = text(input["block"]);
  if (block !== "" && !isRecordId(block))
    throw new ToolRefusal("propose_roles names block by its record id, or leaves it out for the document's own roles");
  const ids = (key: string): string[] => {
    const value = input[key];
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.every((id) => typeof id === "string" && isRoleId(id)))
      throw new ToolRefusal(`propose_roles takes ${key} as a list of role ids`);
    return value as string[];
  };
  const values: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [role, entries] of Object.entries(record(input["values"]))) {
    if (!isRoleId(role)) throw new ToolRefusal(`propose_roles takes values by role id; ${role} is not one`);
    values[role] = record(entries);
  }
  const take = ids("take");
  const clear = ids("clear");
  if (take.length === 0 && clear.length === 0 && Object.keys(values).length === 0)
    throw new ToolRefusal("propose_roles proposes something: take, clear or values");
  return { documentId, ...(block === "" ? {} : { blockId: block }), take, clear, values };
}

const refusalOf = (read: { outcome: string } & Record<string, unknown>): string =>
  read.outcome === "validationFailure"
    ? ((read["failures"] as readonly { detail: string }[] | undefined) ?? []).map((failure) => failure.detail).join(" ")
    : `the roles could not be read: ${read.outcome}`;

/** A taken role as a run reads it: the values by field name. */
const forRun = (role: TakenRole) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  ...(role.builtin ? { builtin: true } : {}),
  ...(role.retired ? { retired: true } : {}),
  ...(role.offered ? {} : { offered: false }),
  ...(role.blocks ? {} : { documentOnly: true }),
  ...(role.notOnBlock === true ? { notOnBlock: true } : {}),
  fields: role.fields.map((field) => ({
    key: field.key,
    name: field.name,
    type: field.type,
    ...(field.required ? { required: true } : {}),
    ...(field.options === undefined ? {} : { options: field.options }),
    value: shownValue(field, role.values[field.key]),
  })),
  ...(role.missing.length === 0 ? {} : { missing: role.missing }),
});

/**
 * read_document_roles: the document's own roles and each block's, with their
 * values and what each may take, at the run's pin — what the person
 * established, never a candidate's.
 */
export async function readDocumentRoles(call: ToolCall): Promise<ToolAnswer> {
  const document = documentOfInput(call.input);
  const read = await rolesOf(document, call.run.pin > 0 ? { dataRevision: call.run.pin } : {});
  if (read.outcome !== "success") throw new ToolRefusal(refusalOf(read as never));
  const view: DocumentRolesView = read.result;
  const named = view.roles.map((role) => role.name).join(", ");
  return {
    result: {
      documentId: view.documentId,
      dataRevision: view.dataRevision,
      roles: view.roles.map(forRun),
      ...(view.inherited.length === 0
        ? {}
        : { inherited: view.inherited.map((role) => ({ id: role.id, name: role.name, description: role.description, on: role.on, document: role.document })) }),
      takeable: view.takeable,
      blocks: view.blocks.map((block) => ({
        blockId: block.blockId,
        kind: block.kind,
        ...(block.parentId === null ? {} : { parentId: block.parentId }),
        roles: block.roles.map(forRun),
        takeable: block.takeable,
      })),
      note: [
        view.inherited.length === 0
          ? ""
          : `This document is the focused work of a block carrying ${[...new Set(view.inherited.map((role) => role.name))].join(", ")}: those roles stand above it, so write it as part of them, and its blocks can take the roles they offer. `,
        view.roles.length === 0 && view.blocks.every((block) => block.roles.length === 0)
          ? view.inherited.length === 0
            ? "Nothing here carries a role; write it as you would any document."
            : "Nothing here carries a role of its own yet. To give a block a role, or a field a value, call propose_roles; it lands only when the person accepts it."
          : `${named === "" ? "Blocks here carry roles" : `This document is a ${named}`}: write each block by its roles. To give a block or the document a role, or a field a value, call propose_roles; it lands only when the person accepts it.`,
      ].join(""),
    },
  };
}

/**
 * propose_roles: roles to take and clear and values to store on one block,
 * or on the document when no block is named, staged into the run's group
 * for the person to accept (`BO_0309_016`). Refused in words where the
 * person's own act would be: a role the block cannot take where it stands, a
 * value for a role it does not take, a value not of its field's type.
 */
export async function proposeRolesTool(call: ToolCall): Promise<ToolAnswer> {
  const proposal = proposalOfInput(call.input);
  const staged = await proposeRoles(proposal);
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
  read_document_roles: readDocumentRoles,
  propose_roles: proposeRolesTool,
} as const;
