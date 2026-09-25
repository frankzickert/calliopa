import { isOrderKey } from "~/lib/order";
import { readRuns, TEXT_ROLES, type Run, type TextRole } from "~/lib/runs";
import { readFrontMatter } from "../lib/front-matter";
import { asRecord } from "~/server/ccgw/nodes";
import { isBlobReference } from "~/server/ccgw/blobs";
import { checkTable, readColumns, readRows } from "~/extensions/documents/lib/table";

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
} from "~/lib/runs";

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

/** The bibliography's work type (`BO_0291_013`): the cited thing a citation
 * run names, a root node of that extension and never a block of a document.
 * Named here only so the document read can tell a work from anything else it
 * finds under a cited identity; the declaration is the bibliography's. */
export const WORK_TYPE = "work";

/**
 * A root's phase (`BO_0249`): proposed is a safe hypothetical environment,
 * accepted means the wider system may rely on it, superseded means another
 * root replaced it — `supersededBy` names which. Absent reads as proposed.
 * Named `phase`, not `state`: `state` is the document's derived refinement
 * state in the reads and a relation's state in the `state` item (`BO_0248`).
 */
export const PHASE_PROPERTY = "phase";
export const SUPERSEDED_BY_PROPERTY = "supersededBy";
/** The dataRevision an acceptance was made at, the one fact it stores:
 * what is accepted is derived from it per claim. BO_0274_005 */
export const ACCEPTED_AT_PROPERTY = "acceptedAt";
export const PHASES = ["proposed", "accepted", "superseded"] as const;
export type Phase = (typeof PHASES)[number];
export const isPhase = (value: unknown): value is Phase =>
  typeof value === "string" && (PHASES as readonly string[]).includes(value);

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
  // The front matter a manuscript's head projects. BO_0293_012
  const frontMatter = readFrontMatter(content);
  if ("failure" in frontMatter) return frontMatter.failure;
  // The formatting switch: whether a settled or an accepted code block is
  // pretty-printed, on unless stored off. BO_0296_013
  if (content["formatCode"] !== undefined && typeof content["formatCode"] !== "boolean") {
    return "A document's formatCode is true or false: whether its code blocks are formatted when an edit settles.";
  }
  // The line-number switch: whether each line of a code block is numbered,
  // shown unless stored off. BO_0302_003
  if (content["lineNumbers"] !== undefined && typeof content["lineNumbers"] !== "boolean") {
    return "A document's lineNumbers is true or false: whether each line of its code blocks is numbered.";
  }
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

/**
 * A table (`BO_0287_008`): typed columns, rows of cells in their columns'
 * spelling, an optional caption, and — behind a file — the core's blob
 * reference with the file's row count. The shape is `lib/table.ts`, shared
 * with the editor and the parser, so a cell is judged one way everywhere.
 */
export function validateTable(value: unknown): string | null {
  const content = asRecord(value);
  if (content === null) return "A table carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;
  if (content["runs"] !== undefined) return "A table carries columns and rows, not runs.";
  const columns = readColumns(content["columns"]);
  if ("failure" in columns) return columns.failure;
  const rows = readRows(content["rows"]);
  if ("failure" in rows) return rows.failure;
  const misfit = checkTable(columns.columns, rows.rows);
  if (misfit !== null) return misfit.failure;
  if (content["caption"] !== undefined && typeof content["caption"] !== "string") return "A table's caption is words.";
  const reference = content["reference"];
  if (reference !== undefined && !isBlobReference(reference)) return "A table's reference is the core's blob reference.";
  const rowCount = content["rowCount"];
  if (rowCount !== undefined) {
    if (typeof rowCount !== "number" || !Number.isInteger(rowCount) || rowCount < 0) return "A table's rowCount is a whole number.";
    if (reference === undefined) return "A table's rowCount goes with the reference of the file behind it.";
  }
  return validateNumbering(content, "A table");
}

/**
 * An equation (`BO_0290_008`): the exact TeX it is set from, an optional
 * caption, and whether its author asked for a number. The number itself is
 * never stored — it is the document's own order, resolved on every read
 * (`assemble.ts`) — so a stored `number` is refused rather than kept as the
 * one stale copy of a derived thing.
 */
export function validateEquation(value: unknown): string | null {
  const content = asRecord(value);
  if (content === null) return "An equation carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;
  if (content["runs"] !== undefined) return "An equation carries its tex, not runs.";
  const tex = content["tex"];
  if (typeof tex !== "string" || tex.trim() === "") return "An equation carries the tex it is set from.";
  if (content["caption"] !== undefined && typeof content["caption"] !== "string") return "An equation's caption is words.";
  const numbered = content["numbered"];
  if (numbered !== undefined && typeof numbered !== "boolean") return "An equation's numbered is true or false.";
  if (content["number"] !== undefined) {
    return "An equation's number is the document's order and is never stored.";
  }
  return null;
}

/**
 * A figure's or a table's caption and number ask (`BO_0295_006`), checked the
 * same way on a picture, a table and an output: a caption is words, the ask is
 * true or false, and a stored `number` is refused — the number is the
 * document's order, as an equation's is.
 */
function validateNumbering(content: Record<string, unknown>, what: string): string | null {
  if (content["caption"] !== undefined && typeof content["caption"] !== "string") return `${what}'s caption is words.`;
  const numbered = content["numbered"];
  if (numbered !== undefined && typeof numbered !== "boolean") return `${what}'s numbered is true or false.`;
  if (content["number"] !== undefined) return `${what}'s number is the document's order and is never stored.`;
  return null;
}

/** A picture (`BO_0273_008`, `BO_0295_006`): its order, and its caption and
 * number ask. The bytes are the core's blob reference, checked by the core. */
export function validateImage(value: unknown): string | null {
  const content = asRecord(value);
  if (content === null) return "A picture carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;
  if (content["runs"] !== undefined) return "A picture carries a caption, not runs.";
  return validateNumbering(content, "A picture");
}

/** Code (`BO_0289_018`): its source as text, and a language as a word. */
export function validateCode(value: unknown): string | null {
  const content = asRecord(value);
  if (content === null) return "A code block carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;
  if (content["runs"] !== undefined) return "A code block carries its source, not runs.";
  if (typeof content["source"] !== "string") return "A code block's source is the code itself, as text.";
  if (content["language"] !== undefined && typeof content["language"] !== "string") return "A code block's language is a word.";
  // Whether the block continues its numbering from the code block above it. BO_0302_004
  if (content["continues"] !== undefined && typeof content["continues"] !== "boolean") {
    return "A code block's continues is true or false: whether its line numbering continues from the code block above it.";
  }
  // A listing's caption and its number's ask, as a picture's. BO_0303_007
  return validateNumbering(content, "A code block");
}

/**
 * An output (`BO_0289_018`): what an execution produced, written by the
 * kernel alone. The shell reads one and refuses to write one, so the check
 * here is the shape a read relies on.
 */
export function validateOutput(value: unknown): string | null {
  const content = asRecord(value);
  if (content === null) return "An output carries content.";
  const order = validateOrder(content);
  if (order !== null) return order;
  if (!Array.isArray(content["items"])) return "An output's items are what the execution streamed, in order.";
  if (typeof content["outcome"] !== "string") return "An output's outcome says how the execution ended.";
  if (typeof content["of"] !== "string") return "An output names the code block it ran.";
  for (const key of ["pictures", "files"] as const) {
    const listed = content[key];
    if (listed !== undefined && (!Array.isArray(listed) || !listed.every((entry) => isBlobReference(entry)))) {
      return `An output's ${key} are the core's blob references.`;
    }
  }
  return validateNumbering(content, "An output");
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
  table: validateTable,
  sourcecode: validateCode,
  output: validateOutput,
  equation: validateEquation,
  image: validateImage,
};
