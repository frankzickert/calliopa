import { isRecordId } from "~/server/uuid";

import type { DocumentRolesView } from "../lib/roles";
import { rolesOf } from "./roles";

/**
 * The tool this extension answers a run (`BO_0299_017`): `read_document_roles`,
 * an `ext.tool` member the kernel offers while the extension is active and
 * posts a call to through the callback. It reads and stages nothing: a run
 * reads roles and never writes them (`BO_0299_Q6`), so the answer carries
 * no `stage`.
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

/** What a tool answers the kernel. */
export interface ToolAnswer {
  readonly result: unknown;
}

/** A tool refused: the run reads the reason and nothing is staged. */
export class ToolRefusal extends Error {}

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** The document a call names, as a record id. */
export function documentOfInput(
  input: Readonly<Record<string, unknown>>,
): string {
  const document = text(input["document"]);
  if (document === "" || !isRecordId(document))
    throw new ToolRefusal(
      "read_document_roles needs document, the document's record id",
    );
  return document;
}

/**
 * read_document_roles: the document's role and each block's, in reading
 * order, at the run's pin — what the person assigned, never a candidate's.
 */
export async function readDocumentRoles(call: ToolCall): Promise<ToolAnswer> {
  const document = documentOfInput(call.input);
  const read = await rolesOf(
    document,
    call.run.pin > 0 ? { dataRevision: call.run.pin } : {},
  );
  if (read.outcome !== "success") {
    const reason =
      read.outcome === "validationFailure"
        ? read.failures.map((failure) => failure.detail).join(" ")
        : `the roles could not be read: ${read.outcome}`;
    throw new ToolRefusal(reason);
  }
  const view: DocumentRolesView = read.result;
  return {
    result: {
      ...view,
      note:
        view.documentRole === null
          ? "This document carries no document role; write it as you would any document."
          : `This document is a ${view.documentRole.name}: write each block by its block role, and propose no role — assigning one is the person's act.`,
    },
  };
}

export const TOOLS = { read_document_roles: readDocumentRoles } as const;
