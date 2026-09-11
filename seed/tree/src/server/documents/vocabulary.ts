import { isOrderKey } from "../../lib/order";
import { readRuns, TEXT_ROLES, type Run, type TextRole } from "../../lib/runs";
import { asRecord } from "./content";

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

/**
 * A change document names the extension it is a change of in `change` and
 * carries its status in `changeStatus`. The status is not `status`, because
 * CCGW reads that key of a CREATE or a SET as the revision's lifecycle, never
 * as content; the declaration permits the change protocol's six values.
 * BO_0222_004
 */
export const CHANGE_PROPERTY = "change";
export const CHANGE_STATUS_PROPERTY = "changeStatus";

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

export function validateDocument(value: unknown): string | null {
  const content = asRecord(value);
  if (content === null) return "A document carries content.";
  if (typeof content["title"] !== "string") return "A document carries a title.";
  return null;
}

export function validateText(value: unknown): string | null {
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

export function validateDivider(value: unknown): string | null {
  const content = asRecord(value);
  if (content === null) return "A divider carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;
  if (content["runs"] !== undefined) {
    return "A divider carries no authored text.";
  }
  return null;
}

/**
 * The shell's own reading of a document's shape, kept beside the graph's
 * declarations of the same vocabulary (`BO_0207_011`): CCGW's Validation
 * enforces the declared properties on every write, and these say in the
 * shell's words what a run, an order key and a role are before one is sent.
 * `contains` is the structural relation — a block has exactly one active
 * containment parent — and `retired` is how a block leaves a document without
 * being deleted.
 */
export const BLOCK_VALIDATORS: Readonly<Record<string, (value: unknown) => string | null>> = {
  [DOCUMENT_TYPE]: validateDocument,
  text: validateText,
  divider: validateDivider,
};
