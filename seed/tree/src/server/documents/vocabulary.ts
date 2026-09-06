import type { JSONValue } from "postgres";

import { isOrderKey } from "../../lib/order";
import { readRuns, TEXT_ROLES, type Run, type TextRole } from "../../lib/runs";
import { asRecord } from "./content";
import type { GraphSchema, NonEmpty } from "../graph/contract";

/**
 * The run primitives are `src/lib/runs.ts`, not a second copy here. The editor
 * builds runs in the browser and this boundary stores them, and "equal
 * normalized content is not written again" only holds while both normalize the
 * same way.
 */
export {
  MARKS,
  TEXT_ROLES,
  normalizeRuns,
  runsText,
  splitRuns,
  type Mark,
  type Run,
  type TextRole,
} from "../../lib/runs";

/**
 * Calliopa's committed document and block vocabulary: the semantic types the
 * graph stores, what their content must hold, and the shape of a text run.
 *
 * Definitions are source in this repository. Adding a block type or widening a
 * permitted set is an ordinary change, and narrowing one is breaking, because
 * content established under the wider set may hold a value the narrower set
 * forbids.
 */

/** The document node type. One generic kind; story concepts arrive later. */
export const DOCUMENT_TYPE = "document";

/** The block types this build understands. A stored type outside this set is
 * unsupported content: shown as such and never silently dropped. */
export const BLOCK_TYPES = ["text", "divider"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export interface DocumentContent {
  readonly title: string;
}

export interface TextContent {
  readonly order: string;
  readonly runs: readonly Run[];
  readonly role?: TextRole;
}

export interface DividerContent {
  readonly order: string;
}

function validateOrder(content: Record<string, unknown>): string | null {
  const order = content["order"];
  if (typeof order !== "string" || !isOrderKey(order)) {
    return "A block carries an order key.";
  }
  return null;
}

function validateDocument(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "A document carries content.";
  if (typeof content["title"] !== "string") return "A document carries a title.";
  return null;
}

function validateText(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "A text block carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;

  const runs = readRuns(content["runs"]);
  if ("failure" in runs) return runs.failure;

  const role = content["role"];
  if (role !== undefined && !TEXT_ROLES.includes(role as TextRole)) {
    return `A text block carries the role ${String(role)}, which is not one of ${TEXT_ROLES.join(", ")}.`;
  }
  return null;
}

function validateDivider(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "A divider carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;
  if (content["runs"] !== undefined) {
    return "A divider carries no authored text.";
  }
  return null;
}

/** Relations may point at any block type, so widening the block vocabulary
 * does not also have to remember to widen containment. */
const blockTargets = [...BLOCK_TYPES] as unknown as NonEmpty<string>;

/**
 * The vocabulary the gateway validates document writes against.
 *
 * `contains` is the structural relation: a block has exactly one active
 * containment parent. `retired` is how a block leaves a document without being
 * deleted — closing containment alone would strand it beyond any rooted read,
 * so retirement is recorded as its own relation and the retired list is an
 * ordinary read from the document.
 */
export const blockDocumentSchema: GraphSchema = {
  nodes: {
    document: {
      semanticType: DOCUMENT_TYPE,
      schemaVersion: 1,
      validate: validateDocument,
    },
    text: { semanticType: "text", schemaVersion: 1, validate: validateText },
    divider: {
      semanticType: "divider",
      schemaVersion: 1,
      validate: validateDivider,
    },
  },
  relations: {
    contains: {
      relationType: "contains",
      schemaVersion: 1,
      fromNodes: [DOCUMENT_TYPE],
      toNodes: blockTargets,
    },
    retired: {
      relationType: "retired",
      schemaVersion: 1,
      fromNodes: [DOCUMENT_TYPE],
      toNodes: blockTargets,
    },
  },
};
