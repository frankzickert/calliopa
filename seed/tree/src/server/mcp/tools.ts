import type postgres from "postgres";

import type { Caller } from "../api-clients.mjs";
import {
  parseDocumentCommand,
  handleDocumentList,
  handleDocumentRead,
} from "../documents/api";
import { proposeDocumentChanges } from "../documents/documents";
import { BLOCK_TYPES } from "../documents/vocabulary";
import { activeRunFor, provenanceOf } from "../agent/runs";
import type { GraphOutcome } from "../graph/contract";
import { refusal, respond, type OutcomeResponse } from "../graph/outcome";
import { MARKS, TEXT_ROLES } from "../../lib/runs";
import { isRecordId } from "../uuid";

/**
 * A JSON Schema fragment. The tool surface publishes these to a caller that
 * has never read this repository, so it is the one place the vocabulary has to
 * be spelled out rather than referred to.
 */
type Schema = Record<string, unknown>;

/**
 * Every enumerated value below is read from the committed vocabulary rather
 * than restated. A block type or a text role added there reaches the tool
 * schema in the same change, so the two surfaces cannot disagree about what a
 * block is while both claiming to be right.
 */
const placement: Schema = {
  type: "object",
  description:
    "Where a block sits among its siblings. Name one anchor or one end.",
  properties: {
    at: { type: "string", enum: ["start", "end"] },
    before: { type: "string", description: "Identity of the following block." },
    after: { type: "string", description: "Identity of the preceding block." },
  },
  additionalProperties: false,
};

const runs: Schema = {
  type: "array",
  description: "The authored text of a block, as marked runs.",
  items: {
    type: "object",
    properties: {
      text: { type: "string" },
      marks: { type: "array", items: { type: "string", enum: [...MARKS] } },
    },
    required: ["text"],
    additionalProperties: false,
  },
};

const newBlock: Schema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...BLOCK_TYPES] },
    role: { type: "string", enum: [...TEXT_ROLES] },
    runs,
  },
  required: ["kind"],
  additionalProperties: false,
};

const proposalItem: Schema = {
  type: "object",
  description:
    "One proposed change. `replace` and `move` name the revision they are based on, so a block written since is a conflict rather than an overwrite.",
  properties: {
    kind: {
      type: "string",
      enum: ["replace", "insert", "remove", "move"],
    },
    blockId: { type: "string" },
    baseRevisionId: { type: "string" },
    role: { type: "string", enum: [...TEXT_ROLES] },
    runs,
    block: newBlock,
    placement,
  },
  required: ["kind"],
  additionalProperties: false,
};

export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Schema;
}

/**
 * The whole tool surface. Documents and blocks are Calliopa's only domain
 * content, so there is nothing else to offer.
 *
 * Writing is staging: an external caller proposes and a human answers. There
 * is deliberately no tool that edits a document, because a tool that wrote
 * truth would be reachable by whatever the model decided to do next.
 */
export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "list_documents",
    title: "List documents",
    description:
      "Every document in the workspace, by identity and title. Nothing else, so listing never pays for block content.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_document",
    title: "Read a document",
    description:
      "One document with its blocks in order, as it currently stands. Read before proposing: a change names the revision it is based on.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "The document's identity." },
      },
      required: ["documentId"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_document_changes",
    title: "Propose changes to a document",
    description:
      "Stages a group of proposed changes against one document. Nothing becomes truth here: a human answers each item, and the answer is theirs to give.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string" },
        items: { type: "array", minItems: 1, items: proposalItem },
      },
      required: ["documentId", "items"],
      additionalProperties: false,
    },
  },
];

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function documentIdOf(
  args: Record<string, unknown>,
): { id: string } | { failure: GraphOutcome<never> } {
  const id = args["documentId"];
  if (typeof id !== "string" || !isRecordId(id)) {
    return {
      failure: {
        outcome: "noResult",
        detail: `No document ${String(id)}.`,
      },
    };
  }
  return { id };
}

/**
 * Runs one tool for a resolved caller.
 *
 * The caller travels into provenance, so a staged group says which client
 * staged it by the mechanism every other external write already uses. The
 * arguments are read by the same parser the JSON route uses, so a shape the
 * one accepts is a shape the other accepts.
 */
export async function callTool(
  sql: postgres.Sql,
  caller: Extract<Caller, { ok: true }>,
  name: string,
  args: unknown,
): Promise<OutcomeResponse<unknown>> {
  const input = record(args) ?? {};

  switch (name) {
    case "list_documents":
      return handleDocumentList(sql);

    case "read_document": {
      const document = documentIdOf(input);
      if ("failure" in document) return respond(document.failure);
      return handleDocumentRead(sql, document.id);
    }

    case "propose_document_changes": {
      const document = documentIdOf(input);
      if ("failure" in document) return respond(document.failure);

      // A staging call is bound to the caller's one active run here, because
      // the agent's MCP client carries no session identity and no per-call
      // metadata: the run cannot arrive as an argument. Staging outside a run
      // is refused rather than attributed to nothing — a group whose
      // provenance is missing cannot be explained to whoever reviews it.
      const run = await activeRunFor(caller.clientId, sql);
      if (run === null) {
        return respond(
          refusal(
            "noActiveRun",
            "A proposal is staged by a run. This caller has none open.",
          ),
        );
      }

      const parsed = parseDocumentCommand({
        command: "propose",
        items: input["items"],
      });
      if ("failure" in parsed) {
        return respond(refusal("proposalShape", parsed.failure));
      }
      if (parsed.command.command !== "propose") {
        return respond(refusal("proposalShape", "Not a proposal."));
      }
      return respond(
        await proposeDocumentChanges(
          sql,
          {
            documentId: document.id,
            items: parsed.command.items,
            request: provenanceOf(run),
          },
          {
            kind: "apiClient",
            clientId: caller.clientId,
            identityClass: caller.identityClass,
          },
        ),
      );
    }

    default:
      return respond(refusal("unknownTool", `There is no ${name} tool.`));
  }
}
