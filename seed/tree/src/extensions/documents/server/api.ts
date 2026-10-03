import { STANDINGS, type Standing } from "~/extensions/documents/lib/disposition";
import type { DocumentSummary } from "~/lib/library";
import { readRuns, TEXT_ROLES, type Run, type TextRole } from "~/lib/runs";
import type { GraphOutcome, NonEmpty } from "~/server/outcome";
import { refusal, respond, type OutcomeResponse } from "~/server/outcome";
import { blobReference, isBlobReference, objectIdOfHash, putBlob, type BlobReference } from "~/server/ccgw/blobs";
import { checkTable, readColumns, readRows, type TableColumn, type TableRow } from "~/extensions/documents/lib/table";
import {
  answerDocumentGroup,
  answerDocumentProposal,
  placeProposedItem,
  createDocument,
  deleteDocument,
  insertBlock,
  insertAdmonitionChild,
  mergeAdmonitionChildren,
  setAdmonitionPattern,
  turnIntoAdmonition,
  listDocuments,
  reviseCode,
  turnIntoCode,
  turnIntoImage,
  turnImageIntoText,
  reviseEquation,
  setFigure,
  setCitationStyle,
  setFormatCode,
  setLineNumbers,
  setCodeContinues,
  reviseTable,
  fillMediaBlock,
  mergeTextBlocks,
  moveBlock,
  proposeDocumentChanges,
  readDocument,
  readDocumentChanges,
  readDocumentProposals,
  readReplayDocument,
  type ReplayDocument,
  reopenProposal,
  renameDocument,
  readRetiredBlocks,
  restoreBlock,
  moveBlockIn,
  moveRetiredBlock,
  retireBlock,
  retireBlocks,
  reviseTextBlock,
  setBlockDisposition,
  splitTextBlock,
  type AnsweredGroup,
  type AnsweredItem,
  type PlacedItem,
  type ChangeSummary,
  type CreatedDocument,
  type DocumentProposalItem,
  type DocumentProposals,
  type NewBlock,
  type NewEquationBlock,
  type NewTableBlock,
  type NewCodeBlock,
  type Placement,
  type ProposalAnswer,
  type SplitBlocks,
  type StagedProposal,
  type WrittenBlock,
  type WrittenDocument,
  promoteBlock,
  type PromotedBlock,
} from "./documents";
import type { BlockView, DocumentView } from "./assemble";
import {
  isRelationKind,
  isRelationOrigin,
  isRelationState,
  RELATION_STATES,
  type RelationEndInput,
  type RelationInput,
} from "./work";
import { readMode, writeMode } from "./working-mode";
import { fixedOf } from "./guards";
import type { WorkingMode } from "../lib/working-mode";
import { branchOf, documentPolicy, readStanding, signedInAccount, type BranchOfDocument, type BranchStanding, type DocumentPolicy } from "./branch";
import { withBranch } from "~/server/ccgw/branch-scope";
import { listAdmonitionPatterns, saveAdmonitionPattern, updateAdmonitionPattern, type AdmonitionPattern } from "./admonitions";
import { reviseRelationReason, setRelationState, type WrittenRelation } from "./work-ops";

/**
 * The transport the editor reaches documents through.
 *
 * Reads and edits are separate entry points, so an accidental edit cannot
 * arrive on a read path. Every edit is one named command carrying exactly what
 * that operation needs, which is what lets an unparseable request be refused
 * before any operation runs rather than part-way through one.
 *
 * Nothing here decides what an operation means. The meanings live in
 * `documents.ts` and the validation lives in the gateway; this reads a request
 * and reports an outcome.
 */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

/** A block identity as the shell mints it, `randomUUID()`'s form. */
const BLOCK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/**
 * Where a block goes among its siblings. A placement names one anchor or one
 * end; anything else is refused rather than guessed at, because guessing puts
 * a block somewhere the author did not ask for.
 */
function readPlacement(
  value: unknown,
): { readonly placement: Placement } | { readonly failure: string } {
  const input = record(value);
  if (input === null) return { failure: "A placement is an object." };
  const at = input["at"];
  if (at === "start" || at === "end") return { placement: { at } };
  const before = text(input["before"]);
  if (before !== null) return { placement: { before } };
  const after = text(input["after"]);
  if (after !== null) return { placement: { after } };
  // Two order keys, either null at an end. BO_0263_001
  const between = input["between"];
  if (Array.isArray(between) && between.length === 2) {
    const keys = between.map((key: unknown) => (key === null ? null : text(key)));
    if (keys.every((key, index) => key !== null || between[index] === null)) {
      return { placement: { between: [keys[0] ?? null, keys[1] ?? null] } };
    }
  }
  return {
    failure: "A placement names a block to go before or after, two order keys to go between, or an end.",
  };
}

/**
 * A table as a request carries it (`BO_0287_008`): columns, rows and an
 * optional caption; and, from an import, the file's blob reference with its
 * row count and where the data came from. A cell outside its column's type
 * is refused naming the cell and the column.
 */
function readTableBlock(
  input: Record<string, unknown>,
): { readonly block: NewTableBlock } | { readonly failure: string } {
  if (input["runs"] !== undefined) return { failure: "A table carries columns and rows, not runs." };
  const columns = readColumns(input["columns"]);
  if ("failure" in columns) return columns;
  const rows = readRows(input["rows"]);
  if ("failure" in rows) return rows;
  const misfit = checkTable(columns.columns, rows.rows);
  if (misfit !== null) return { failure: misfit.failure };
  const caption = input["caption"];
  if (caption !== undefined && typeof caption !== "string") return { failure: "A table's caption is words." };
  const reference = input["reference"];
  if (reference !== undefined && !isBlobReference(reference)) return { failure: "A table's reference is the core's blob reference." };
  const rowCount = input["rowCount"];
  if (rowCount !== undefined && (typeof rowCount !== "number" || !Number.isInteger(rowCount) || rowCount < 0)) {
    return { failure: "A table's rowCount is a whole number." };
  }
  if (rowCount !== undefined && reference === undefined) return { failure: "A table's rowCount goes with the reference of the file behind it." };
  const source = record(input["source"]);
  return {
    block: {
      kind: "table",
      columns: columns.columns,
      rows: rows.rows,
      ...(typeof caption === "string" ? { caption } : {}),
      ...(isBlobReference(reference) ? { reference } : {}),
      ...(typeof rowCount === "number" ? { rowCount } : {}),
      ...(source === null ? {} : { source }),
    },
  };
}

/** Code (`BO_0289_018`): its source as text and, optionally, its language. */
function readCodeBlock(
  input: Record<string, unknown>,
): { readonly block: NewCodeBlock } | { readonly failure: string } {
  if (input["runs"] !== undefined) return { failure: "A code block carries its source, not runs." };
  const source = input["source"];
  if (typeof source !== "string") return { failure: "A code block's source is the code itself, as text." };
  const language = input["language"];
  if (language !== undefined && typeof language !== "string") return { failure: "A code block's language is a word." };
  return {
    block: {
      kind: "sourcecode",
      source,
      ...(typeof language === "string" && language.trim() !== "" ? { language: language.trim() } : {}),
    },
  };
}

/**
 * A new equation (`BO_0290_028`): the exact TeX, an optional caption and the
 * author ask for a number. The number itself is never taken — it is the
 * document own order, resolved on every read.
 */
function readEquationBlock(
  input: Record<string, unknown>,
): { readonly block: NewEquationBlock } | { readonly failure: string } {
  if (input["runs"] !== undefined) return { failure: "An equation carries its tex, not runs." };
  const tex = input["tex"];
  if (typeof tex !== "string" || tex.trim() === "") {
    return { failure: "An equation carries the tex it is set from." };
  }
  const caption = input["caption"];
  if (caption !== undefined && typeof caption !== "string") return { failure: "An equation caption is words." };
  const numbered = input["numbered"];
  if (numbered !== undefined && typeof numbered !== "boolean") {
    return { failure: "An equation numbered is true or false." };
  }
  if (input["number"] !== undefined) {
    return { failure: "An equation number is the document order and is never written." };
  }
  const source = record(input["source"]);
  return {
    block: {
      kind: "equation",
      tex,
      ...(caption === undefined || caption.trim() === "" ? {} : { caption }),
      ...(numbered === true ? { numbered: true } : {}),
      ...(source === null ? {} : { source }),
    },
  };
}

/** A new block: the types this build writes, and nothing else. */
function readNewBlock(
  value: unknown,
): { readonly block: NewBlock } | { readonly failure: string } {
  const input = record(value);
  if (input === null) return { failure: "A block is an object." };
  const kind = input["kind"];
  if (kind === "divider") return { block: { kind: "divider" } };
  if (kind === "admonition") {
    const patternId = text(input["patternId"]);
    if (patternId === null) return { failure: "An admonition names a saved pattern." };
    const rawChildren = input["children"];
    const sources = Array.isArray(rawChildren) ? rawChildren : [{ kind: "text", runs: [{ text: "Write your callout…" }] }];
    const children: { kind: "text"; runs: readonly Run[]; role?: TextRole }[] = [];
    for (const source of sources) {
      const child = record(source);
      if (child === null || child["kind"] !== "text") return { failure: "An admonition contains ordered text blocks." };
      const runs = readRuns(child["runs"]);
      if ("failure" in runs) return runs;
      const role = readStructure(child["role"]);
      if ("failure" in role) return role;
      children.push({ kind: "text", runs: runs.runs, ...(role.role === undefined ? {} : { role: role.role }) });
    }
    if (children.length === 0) return { failure: "An admonition contains at least one text block." };
    return { block: { kind: "admonition", patternId, children } };
  }
  if (kind === "table") return readTableBlock(input);
  if (kind === "image") return { block: { kind: "image" } };
  if (kind === "sourcecode") return readCodeBlock(input);
  if (kind === "equation") return readEquationBlock(input);
  if (kind === "output") {
    return { failure: "An output block is what an execution produced; send the code instead of writing its output." };
  }
  if (kind !== "text") {
    return { failure: `A new block is text, a divider, an image, a table, an equation or code, not ${String(kind)}.` };
  }
  const role = readStructure(input["role"]);
  if ("failure" in role) return role;
  const runs =
    input["runs"] === undefined ? { runs: [] } : readRuns(input["runs"]);
  if ("failure" in runs) return runs;
  return {
    block: {
      kind: "text",
      runs: runs.runs,
      ...(role.role === undefined ? {} : { role: role.role }),
    },
  };
}

function readStructure(
  value: unknown,
): { readonly role: TextRole | undefined } | { readonly failure: string } {
  if (value === undefined) return { role: undefined };
  if (!TEXT_ROLES.includes(value as TextRole)) {
    return {
      failure: `A text block carries the role ${String(value)}, which is not one of ${TEXT_ROLES.join(", ")}.`,
    };
  }
  return { role: value as TextRole };
}

/** The edits the editor issues, each carrying exactly what it needs. */
export type DocumentCommand =
  | { readonly command: "insert"; readonly block: NewBlock; readonly placement: Placement }
  | { readonly command: "fillMediaBlock"; readonly blockId: string; readonly baseRevisionId: string; readonly reference: BlobReference; readonly width: number; readonly height: number }
  | { readonly command: "setAdmonitionPattern"; readonly blockId: string; readonly baseRevisionId: string; readonly patternId: string }
  | { readonly command: "turnIntoAdmonition"; readonly blockId: string; readonly baseRevisionId: string; readonly patternId: string }
  | { readonly command: "insertAdmonitionChild"; readonly parentBlockId: string; readonly afterBlockId?: string; readonly runs: readonly Run[] }
  | { readonly command: "mergeAdmonitionChild"; readonly parentBlockId: string; readonly intoBlockId: string; readonly intoBaseRevisionId: string; readonly blockId: string; readonly baseRevisionId: string }
  | {
      readonly command: "revise";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly runs: readonly Run[];
      readonly role: TextRole | undefined;
    }
  /** An equation revised whole: its source, caption and ask for a number.
   * BO_0290_012 */
  | {
      readonly command: "reviseEquation";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly tex: string;
      readonly caption?: string;
      readonly numbered?: boolean;
    }
  /** A picture's or an output's caption and number ask, a table's ask, or a
   * code block's caption and ask as a listing. BO_0295_008 BO_0303_008 */
  | {
      readonly command: "setFigure";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly caption?: string;
      readonly captionRuns?: readonly Run[];
      readonly numbered?: boolean;
    }
  /** A document's own citation style, or null for the instance's default. BO_0291_037 */
  | { readonly command: "setCitationStyle"; readonly baseRevisionId: string; readonly style: string | null }
  /** The document's formatting switch: whether a settled or an accepted code block is pretty-printed. BO_0296_021 */
  | { readonly command: "setFormatCode"; readonly baseRevisionId: string; readonly on: boolean }
  /** The document's line-number switch: whether each line of a code block is numbered. BO_0302_007 */
  | { readonly command: "setLineNumbers"; readonly baseRevisionId: string; readonly on: boolean }
  /** A code block set to continue its numbering from the code block above it, or not. BO_0302_008 */
  | { readonly command: "setCodeContinues"; readonly blockId: string; readonly baseRevisionId: string; readonly continues: boolean }
  /** A document's front matter set whole. BO_0293_012 */
  /** A text block turned into a code block in its place. BO_0289_021 */
  | { readonly command: "turnIntoCode"; readonly blockId: string; readonly baseRevisionId: string }
  | { readonly command: "turnIntoImage"; readonly blockId: string; readonly baseRevisionId: string }
  | { readonly command: "turnImageIntoText"; readonly blockId: string; readonly baseRevisionId: string; readonly role: TextRole }
  /** A code block revised whole: its source and language. BO_0289_018 */
  | {
      readonly command: "reviseCode";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly source: string;
      readonly language?: string;
    }
  /** A table revised whole: its columns, rows and caption. BO_0287_009 */
  | {
      readonly command: "reviseTable";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly columns: readonly TableColumn[];
      readonly rows: readonly TableRow[];
      readonly caption?: string;
    }
  | {
      readonly command: "setDisposition";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly standing: Standing;
    }
  | {
      readonly command: "split";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly at: number;
      readonly tailBlockId?: string;
      /** The head's words as the editor holds them, split rather than the
       * runs at the base revision, so a split after typing is one write of
       * the head. DO_0015_001 */
      readonly runs?: readonly Run[];
      readonly role?: TextRole;
    }
  | {
      readonly command: "merge";
      readonly intoBlockId: string;
      readonly intoBaseRevisionId: string;
      readonly blockId: string;
    }
  | {
      readonly command: "move";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly placement: Placement;
    }
  | {
      readonly command: "rename";
      readonly baseRevisionId: string;
      readonly title: string;
    }
  | { readonly command: "delete"; readonly baseRevisionId: string }
  | { readonly command: "retire"; readonly blockId: string }
  /** Several blocks retired in one write, each at the revision the reader
   * saw. DO_0023_004 */
  | {
      readonly command: "retireBlocks";
      readonly blocks: readonly { readonly blockId: string; readonly baseRevisionId: string }[];
    }
  /** Opens a block as focused work, or answers the child it has. CA_0047_002 */
  | {
      readonly command: "propose";
      readonly items: NonEmpty<DocumentProposalItem>;
    }
  /** A rejected proposal staged again as a new open one. BO_0315_015 */
  | { readonly command: "reopen"; readonly itemId: string }
  | {
      readonly command: "answerProposal";
      readonly itemId: string;
      readonly answer: ProposalAnswer;
      /** An edit's acceptance, over what the block did since. CA_0042_002 */
      readonly edited?: boolean;
    }
  /** Every item of one group answered at once: *Accept all*, *Reject all*. BO_0343_012 */
  | { readonly command: "answerGroup"; readonly groupId: string; readonly answer: ProposalAnswer }
  | {
      readonly command: "placeProposal";
      readonly itemId: string;
      readonly placement: Placement;
    }
  | {
      readonly command: "restore";
      readonly blockId: string;
      readonly placement: Placement;
    }
  /** A block of another document moved into this one, at the placement.
   * CA_0072_006 */
  | {
      readonly command: "moveIn";
      readonly blockId: string;
      readonly fromDocumentId: string;
      readonly placement: Placement;
    }
  /** A retired block moved, still retired. BO_0263_012 */
  | {
      readonly command: "moveRetired";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly placement: Placement;
    }
  /** The work operations (`BO_0244_007`). */
  | { readonly command: "reviseReason"; readonly relationId: string; readonly baseRevisionId: string; readonly reason: readonly Run[] }
  | { readonly command: "setRelationState"; readonly relationId: string; readonly baseRevisionId: string; readonly state: (typeof RELATION_STATES)[number] }
  | { readonly command: "promoteBlock"; readonly group: string; readonly blockId: string };

/** One end of a relation, as a request names it: a block. */
function readRelationEnd(value: unknown): { readonly end: RelationEndInput } | { readonly failure: string } {
  const input = record(value);
  const blockId = input === null ? null : text(input["blockId"]);
  if (blockId === null) return { failure: "A relation's end is an object naming a blockId." };
  return { end: { blockId } };
}

/** A relation as a request names it: kind, reason, origin and its ends. */
function readRelation(value: unknown): { readonly relation: RelationInput } | { readonly failure: string } {
  const input = record(value);
  if (input === null) return { failure: "A relation is an object." };
  const kind = input["kind"];
  if (!isRelationKind(kind)) return { failure: `A relation's kind is one of the declared kinds, not ${String(kind)}.` };
  const reason = readRuns(input["reason"]);
  if ("failure" in reason) return { failure: "A relation gives its reason as runs." };
  const origin = input["origin"];
  if (origin !== undefined && !isRelationOrigin(origin)) return { failure: "A relation's origin is declared, derived or inferred." };
  const source = readRelationEnd(input["source"]);
  if ("failure" in source) return source;
  const target = readRelationEnd(input["target"]);
  if ("failure" in target) return target;
  return {
    relation: {
      kind,
      reason: reason.runs,
      ...(isRelationOrigin(origin) ? { origin } : {}),
      source: source.end,
      target: target.end,
    },
  };
}

export function parseDocumentCommand(
  value: unknown,
): { readonly command: DocumentCommand } | { readonly failure: string } {
  const input = record(value);
  if (input === null) return { failure: "A command is an object." };
  const name = input["command"];
  const blockId = text(input["blockId"]);
  const baseRevisionId = text(input["baseRevisionId"]);

  switch (name) {
    case "insert": {
      const block = readNewBlock(input["block"]);
      if ("failure" in block) return block;
      const placement = readPlacement(input["placement"]);
      if ("failure" in placement) return placement;
      return {
        command: {
          command: "insert",
          block: block.block,
          placement: placement.placement,
        },
      };
    }
    case "insertAdmonitionChild": {
      const parentBlockId = text(input["parentBlockId"]);
      const afterBlockId = text(input["afterBlockId"]);
      const runs = input["runs"] === undefined ? { runs: [] } : readRuns(input["runs"]);
      if (parentBlockId === null) return { failure: "An admonition child names its container." };
      if ("failure" in runs) return runs;
      return { command: { command: "insertAdmonitionChild", parentBlockId, ...(afterBlockId === null ? {} : { afterBlockId }), runs: runs.runs } };
    }
    case "mergeAdmonitionChild": {
      const parentBlockId = text(input["parentBlockId"]);
      const intoBlockId = text(input["intoBlockId"]);
      const intoBaseRevisionId = text(input["intoBaseRevisionId"]);
      const blockId = text(input["blockId"]);
      const childBaseRevisionId = text(input["baseRevisionId"]);
      if (parentBlockId === null || intoBlockId === null || intoBaseRevisionId === null || blockId === null || childBaseRevisionId === null) {
        return { failure: "Merging admonition children names their container, survivor and absorbed child, and both base revisions." };
      }
      return { command: { command: "mergeAdmonitionChild", parentBlockId, intoBlockId, intoBaseRevisionId, blockId, baseRevisionId: childBaseRevisionId } };
    }
    case "setAdmonitionPattern": {
      const patternId = text(input["patternId"]);
      if (blockId === null || baseRevisionId === null || patternId === null) return { failure: "Changing an admonition pattern names its block, base revision, and saved pattern." };
      return { command: { command: "setAdmonitionPattern", blockId, baseRevisionId, patternId } };
    }
    case "turnIntoAdmonition": {
      const patternId = text(input["patternId"]);
      if (blockId === null || baseRevisionId === null || patternId === null) return { failure: "Turning a text block into an admonition names its block, base revision, and saved pattern." };
      return { command: { command: "turnIntoAdmonition", blockId, baseRevisionId, patternId } };
    }
    case "fillMediaBlock": {
      if (blockId === null || baseRevisionId === null) return { failure: "Filling an image names its block and base revision." };
      const reference = input["reference"];
      if (!isBlobReference(reference)) return { failure: "An image reference is the core's blob reference." };
      const width = input["width"];
      const height = input["height"];
      if (typeof width !== "number" || !Number.isSafeInteger(width) || width < 1 || typeof height !== "number" || !Number.isSafeInteger(height) || height < 1) {
        return { failure: "An uploaded image carries its positive pixel width and height." };
      }
      return { command: { command: "fillMediaBlock", blockId, baseRevisionId, reference, width, height } };
    }
    case "revise": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A revise names a block and the revision it is based on." };
      }
      const runs = readRuns(input["runs"]);
      if ("failure" in runs) return runs;
      const role = readStructure(input["role"]);
      if ("failure" in role) return role;
      return {
        command: {
          command: "revise",
          blockId,
          baseRevisionId,
          runs: runs.runs,
          role: role.role,
        },
      };
    }
    case "reviseEquation": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "An equation revise names a block and the revision it is based on." };
      }
      const tex = input["tex"];
      if (typeof tex !== "string" || tex.trim() === "") {
        return { failure: "An equation carries the tex it is set from." };
      }
      const caption = input["caption"];
      if (caption !== undefined && typeof caption !== "string") {
        return { failure: "An equation's caption is words." };
      }
      const numbered = input["numbered"];
      if (numbered !== undefined && typeof numbered !== "boolean") {
        return { failure: "An equation's numbered is true or false." };
      }
      return {
        command: {
          command: "reviseEquation",
          blockId,
          baseRevisionId,
          tex,
          ...(caption === undefined ? {} : { caption }),
          ...(numbered === undefined ? {} : { numbered }),
        },
      };
    }
    case "setFigure": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "Numbering a figure or a table names a block and the revision it is based on." };
      }
      const caption = input["caption"];
      if (caption !== undefined && typeof caption !== "string") {
        return { failure: "A figure's caption is words." };
      }
      const numbered = input["numbered"];
      if (numbered !== undefined && typeof numbered !== "boolean") {
        return { failure: "A figure's or a table's numbered is true or false." };
      }
      const captionRuns = input["captionRuns"] === undefined ? undefined : readRuns(input["captionRuns"]);
      if (captionRuns !== undefined && "failure" in captionRuns) return captionRuns;
      if (captionRuns !== undefined && captionRuns.runs.some((run) => (run.marks?.length ?? 0) > 0)) return { failure: "An image caption preserves links and has no formatting marks." };
      if (input["number"] !== undefined) {
        return { failure: "A number is the document's order and is never written." };
      }
      return {
        command: {
          command: "setFigure",
          blockId,
          baseRevisionId,
          ...(caption === undefined ? {} : { caption }),
          ...(captionRuns === undefined ? {} : { captionRuns: captionRuns.runs }),
          ...(numbered === undefined ? {} : { numbered }),
        },
      };
    }
    case "setCitationStyle": {
      if (baseRevisionId === null) {
        return { failure: "Setting the citation style names the revision of the document it is based on." };
      }
      const style = input["style"];
      if (style !== null && (typeof style !== "string" || style.trim() === "")) {
        return { failure: "A citation style is a style's id, or null for the instance's default." };
      }
      return { command: { command: "setCitationStyle", baseRevisionId, style } };
    }
    case "setFormatCode": {
      if (baseRevisionId === null) {
        return { failure: "Switching code formatting names the revision of the document it is based on." };
      }
      const on = input["on"];
      if (typeof on !== "boolean") {
        return { failure: "Format code is switched on or off: on is true or false." };
      }
      return { command: { command: "setFormatCode", baseRevisionId, on } };
    }
    case "setLineNumbers": {
      if (baseRevisionId === null) {
        return { failure: "Switching line numbers names the revision of the document it is based on." };
      }
      const on = input["on"];
      if (typeof on !== "boolean") {
        return { failure: "Line numbers are switched on or off: on is true or false." };
      }
      return { command: { command: "setLineNumbers", baseRevisionId, on } };
    }
    case "setCodeContinues": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "Continuing a code block's numbering names the block and the revision it is based on." };
      }
      const continues = input["continues"];
      if (typeof continues !== "boolean") {
        return { failure: "A code block continues its numbering or not: continues is true or false." };
      }
      return { command: { command: "setCodeContinues", blockId, baseRevisionId, continues } };
    }
    case "turnIntoCode": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "Turning a block into code names the block and the revision it is based on." };
      }
      return { command: { command: "turnIntoCode", blockId, baseRevisionId } };
    }
    case "turnIntoImage": {
      if (blockId === null || baseRevisionId === null) return { failure: "Turning a block into an image names the block and its base revision." };
      return { command: { command: "turnIntoImage", blockId, baseRevisionId } };
    }
    case "turnImageIntoText": {
      if (blockId === null || baseRevisionId === null) return { failure: "Turning an image into text names the block and its base revision." };
      const role = readStructure(input["role"]);
      if ("failure" in role || role.role === undefined) return { failure: "Turning an image into text names a text role." };
      return { command: { command: "turnImageIntoText", blockId, baseRevisionId, role: role.role } };
    }
    case "reviseCode": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A code revise names a block and the revision it is based on." };
      }
      const code = readCodeBlock({ source: input["source"], ...(input["language"] === undefined ? {} : { language: input["language"] }) });
      if ("failure" in code) return code;
      return {
        command: {
          command: "reviseCode",
          blockId,
          baseRevisionId,
          source: code.block.source,
          ...(code.block.language === undefined ? {} : { language: code.block.language }),
        },
      };
    }
    case "reviseTable": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A table revise names a block and the revision it is based on." };
      }
      const table = readTableBlock({ columns: input["columns"], rows: input["rows"], ...(input["caption"] === undefined ? {} : { caption: input["caption"] }) });
      if ("failure" in table) return table;
      return {
        command: {
          command: "reviseTable",
          blockId,
          baseRevisionId,
          columns: table.block.columns,
          rows: table.block.rows,
          ...(table.block.caption === undefined ? {} : { caption: table.block.caption }),
        },
      };
    }
    case "setDisposition": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A standing names a block and the revision it is based on." };
      }
      // Neutral is named rather than left out, so a body that forgot the
      // field is refused rather than read as clearing the block's standing.
      const standing = input["standing"];
      if (typeof standing !== "string" || !(STANDINGS as readonly string[]).includes(standing)) {
        return { failure: `A standing is one of ${STANDINGS.join(", ")}.` };
      }
      return {
        command: {
          command: "setDisposition",
          blockId,
          baseRevisionId,
          standing: standing as Standing,
        },
      };
    }
    case "split": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A split names a block and the revision it is based on." };
      }
      const at = input["at"];
      if (typeof at !== "number" || !Number.isInteger(at) || at < 0) {
        return { failure: "A split happens at a character position." };
      }
      // The head's words, when the editor sends them: the split then splits
      // these, and the head is written once. DO_0015_001
      const runs = input["runs"] === undefined ? { runs: undefined } : readRuns(input["runs"]);
      if ("failure" in runs) return runs;
      const role = readStructure(input["role"]);
      if ("failure" in role) return role;
      const words = {
        ...(runs.runs === undefined ? {} : { runs: runs.runs }),
        ...(role.role === undefined ? {} : { role: role.role }),
      };
      // The tail's identity, when the editor chose it: a UUID, as every block
      // identity the shell mints is. CA_0045_004
      const tail = input["tailBlockId"];
      if (tail === undefined) {
        return { command: { command: "split", blockId, baseRevisionId, at, ...words } };
      }
      if (typeof tail !== "string" || !BLOCK_ID.test(tail)) {
        return { failure: "A split's tail is named by a block identity." };
      }
      return { command: { command: "split", blockId, baseRevisionId, at, tailBlockId: tail, ...words } };
    }
    case "merge": {
      const intoBlockId = text(input["intoBlockId"]);
      const intoBaseRevisionId = text(input["intoBaseRevisionId"]);
      if (blockId === null || intoBlockId === null || intoBaseRevisionId === null) {
        return {
          failure:
            "A merge names both blocks and the revision the surviving one is based on.",
        };
      }
      return {
        command: { command: "merge", blockId, intoBlockId, intoBaseRevisionId },
      };
    }
    case "move": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A move names a block and the revision it is based on." };
      }
      const placement = readPlacement(input["placement"]);
      if ("failure" in placement) return placement;
      return {
        command: {
          command: "move",
          blockId,
          baseRevisionId,
          placement: placement.placement,
        },
      };
    }
    case "rename": {
      if (baseRevisionId === null) {
        return {
          failure: "A rename names the document revision it is based on.",
        };
      }
      const title = input["title"];
      if (typeof title !== "string") {
        return { failure: "A rename carries a title." };
      }
      return { command: { command: "rename", baseRevisionId, title } };
    }
    case "delete": {
      if (baseRevisionId === null) {
        return {
          failure: "A delete names the document revision it is based on.",
        };
      }
      return { command: { command: "delete", baseRevisionId } };
    }
    case "retire": {
      if (blockId === null) return { failure: "A retire names a block." };
      return { command: { command: "retire", blockId } };
    }
    case "retireBlocks": {
      const blocks = input["blocks"];
      if (!Array.isArray(blocks) || blocks.length === 0) {
        return { failure: "A retirement of several blocks names them." };
      }
      const named: { blockId: string; baseRevisionId: string }[] = [];
      for (const entry of blocks) {
        const record = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
        const id = text(record["blockId"]);
        const base = text(record["baseRevisionId"]);
        if (id === null || base === null) {
          return { failure: "Each block retired names itself and the revision it is based on." };
        }
        named.push({ blockId: id, baseRevisionId: base });
      }
      return { command: { command: "retireBlocks", blocks: named } };
    }
    case "promoteBlock": {
      const group = text(input["group"]);
      if (group === null) return { failure: "A promotion names the rejected branch's group." };
      if (blockId === null) return { failure: "A promotion names the block." };
      return { command: { command: "promoteBlock", group, blockId } };
    }
    case "propose": {
      const items = input["items"];
      if (!Array.isArray(items) || items.length === 0) {
        return { failure: "A proposal names at least one change." };
      }
      const read = items.map(readProposalItem);
      const failed = read.find((item) => "failure" in item);
      if (failed !== undefined && "failure" in failed) return failed;
      const [first, ...rest] = read as { item: DocumentProposalItem }[];
      return {
        command: {
          command: "propose",
          items: [
            (first as { item: DocumentProposalItem }).item,
            ...rest.map((entry) => entry.item),
          ],
        },
      };
    }
    case "reopen": {
      const itemId = input["itemId"];
      if (typeof itemId !== "string") return { failure: "A reopening names the rejected proposal it reopens." };
      return { command: { command: "reopen", itemId } };
    }
    case "answerProposal": {
      const itemId = input["itemId"];
      const answer = input["answer"];
      if (typeof itemId !== "string") {
        return { failure: "An answer names the proposed change it answers." };
      }
      if (answer !== "accepted" && answer !== "rejected") {
        return { failure: "A proposed change is accepted or rejected." };
      }
      const edited = input["edited"];
      if (edited !== undefined && typeof edited !== "boolean") {
        return { failure: "Whether an answer is an edit's is true or false." };
      }
      return { command: { command: "answerProposal", itemId, answer, ...(edited === true ? { edited } : {}) } };
    }
    case "answerGroup": {
      const groupId = input["groupId"];
      const answer = input["answer"];
      if (typeof groupId !== "string" || groupId === "") return { failure: "An answer to a whole proposal names its group." };
      if (answer !== "accepted" && answer !== "rejected") return { failure: "A proposal is accepted or rejected." };
      return { command: { command: "answerGroup", groupId, answer } };
    }
    case "placeProposal": {
      const itemId = input["itemId"];
      if (typeof itemId !== "string") {
        return { failure: "A placement names the proposed change it moves." };
      }
      const placement = readPlacement(input["placement"]);
      if ("failure" in placement) return placement;
      return { command: { command: "placeProposal", itemId, placement: placement.placement } };
    }
    case "restore": {
      if (blockId === null) return { failure: "A restore names a block." };
      const placement = readPlacement(input["placement"]);
      if ("failure" in placement) return placement;
      return {
        command: { command: "restore", blockId, placement: placement.placement },
      };
    }
    case "moveIn": {
      const fromDocumentId = text(input["fromDocumentId"]);
      if (blockId === null || fromDocumentId === null) {
        return { failure: "A move from another document names the block and the document it comes from." };
      }
      const placement = readPlacement(input["placement"]);
      if ("failure" in placement) return placement;
      return { command: { command: "moveIn", blockId, fromDocumentId, placement: placement.placement } };
    }
    case "moveRetired": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A retired block's move names the block and the revision it is based on." };
      }
      const placement = readPlacement(input["placement"]);
      if ("failure" in placement) return placement;
      return { command: { command: "moveRetired", blockId, baseRevisionId, placement: placement.placement } };
    }
    case "reviseReason": {
      const relationId = text(input["relationId"]);
      if (relationId === null || baseRevisionId === null) return { failure: "A reason names the relation and the revision it is based on." };
      const reason = readRuns(input["reason"]);
      if ("failure" in reason) return { failure: "A relation gives its reason as runs." };
      return { command: { command: "reviseReason", relationId, baseRevisionId, reason: reason.runs } };
    }
    case "setRelationState": {
      const relationId = text(input["relationId"]);
      if (relationId === null || baseRevisionId === null) return { failure: "A state names the relation and the revision it is based on." };
      const state = input["state"];
      if (!isRelationState(state)) return { failure: `A relation's state is one of ${RELATION_STATES.join(", ")}.` };
      return { command: { command: "setRelationState", relationId, baseRevisionId, state } };
    }
    default:
      return { failure: `There is no ${String(name)} command.` };
  }
}

/**
 * One proposed change, read from a request.
 *
 * Proposing is a command like any other on this route: an in-application
 * proposer — an import, a bulk transform — reaches a document through the same
 * transport its editor does. What an external caller stages goes through the
 * gateway's own endpoint instead, carrying its client identity with it.
 */
function readProposalItem(
  value: unknown,
): { readonly item: DocumentProposalItem } | { readonly failure: string } {
  const input = record(value);
  if (input === null) return { failure: "A proposed change is an object." };
  const kind = input["kind"];
  const blockId = input["blockId"];
  const baseRevisionId = input["baseRevisionId"];

  if (kind === "insert") {
    const block = readNewBlock(input["block"]);
    if ("failure" in block) return block;
    const placement = readPlacement(input["placement"]);
    if ("failure" in placement) return placement;
    return {
      item: {
        kind: "insert",
        block: block.block,
        placement: placement.placement,
      },
    };
  }
  if (kind === "relate") {
    const relation = readRelation(input["relation"]);
    if ("failure" in relation) return relation;
    return { item: { kind: "relate", relation: relation.relation } };
  }
  if (kind === "reason") {
    const relationId = text(input["relationId"]);
    if (relationId === null) return { failure: "A proposed reason names its relation." };
    const reason = readRuns(input["reason"]);
    if ("failure" in reason) return { failure: "A relation gives its reason as runs." };
    return { item: { kind: "reason", relationId, reason: reason.runs } };
  }
  if (kind === "state") {
    const relationId = text(input["relationId"]);
    if (relationId === null) return { failure: "A proposed state names its relation." };
    const state = input["state"];
    if (!isRelationState(state)) return { failure: `A relation's state is one of ${RELATION_STATES.join(", ")}.` };
    return { item: { kind: "state", relationId, state } };
  }
  if (typeof blockId !== "string") {
    return { failure: "A proposed change names the block it concerns." };
  }
  if (kind === "remove") return { item: { kind: "remove", blockId } };
  if (typeof baseRevisionId !== "string") {
    return {
      failure: "A proposed rewrite or move names the revision it is based on.",
    };
  }
  if (kind === "move") {
    const placement = readPlacement(input["placement"]);
    if ("failure" in placement) return placement;
    return {
      item: {
        kind: "move",
        blockId,
        baseRevisionId,
        placement: placement.placement,
      },
    };
  }
  if (kind !== "replace") {
    return { failure: `There is no ${String(kind)} proposed change.` };
  }
  const runs = readRuns(input["runs"]);
  if ("failure" in runs) return runs;
  const role = readStructure(input["role"]);
  if ("failure" in role) return role;
  return {
    item: {
      kind: "replace",
      blockId,
      baseRevisionId,
      runs: runs.runs,
      ...(role.role === undefined ? {} : { role: role.role }),
    },
  };
}

/** Runs one parsed command against a document. */
export function runDocumentCommand(
  documentId: string,
  command: DocumentCommand,
): Promise<
  GraphOutcome<
    | WrittenBlock
    | SplitBlocks
    | WrittenDocument
    | AnsweredItem
    | AnsweredGroup
    | StagedProposal
    | PlacedItem
    | WrittenRelation
    | { readonly relationId: string; readonly revisionId: string; readonly dataRevision: string }
    | { readonly blockIds: readonly string[]; readonly dataRevision: string }
    | PromotedBlock
  >
> {
  switch (command.command) {
    case "fillMediaBlock":
      return fillMediaBlock({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        reference: command.reference,
        width: command.width,
        height: command.height,
      });
    case "promoteBlock":
      return signedInAccount().then((account) =>
        account.outcome !== "success"
          ? (account as GraphOutcome<never>)
          : promoteBlock({ documentId, group: command.group, blockId: command.blockId, account: account.result }),
      );
    case "turnIntoCode":
      return turnIntoCode({ documentId, blockId: command.blockId, baseRevisionId: command.baseRevisionId });
    case "turnIntoImage":
      return turnIntoImage({ documentId, blockId: command.blockId, baseRevisionId: command.baseRevisionId });
    case "turnIntoAdmonition":
      return turnIntoAdmonition({ documentId, blockId: command.blockId, baseRevisionId: command.baseRevisionId, patternId: command.patternId });
    case "turnImageIntoText":
      return turnImageIntoText({ documentId, blockId: command.blockId, baseRevisionId: command.baseRevisionId, role: command.role });
    case "reviseCode":
      return reviseCode({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        source: command.source,
        ...(command.language === undefined ? {} : { language: command.language }),
      });
    case "reviseEquation":
      return reviseEquation({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        tex: command.tex,
        ...(command.caption === undefined ? {} : { caption: command.caption }),
        ...(command.numbered === undefined ? {} : { numbered: command.numbered }),
      });
    case "setCitationStyle":
      return setCitationStyle({ documentId, baseRevisionId: command.baseRevisionId, style: command.style });
    case "setFormatCode":
      return setFormatCode({ documentId, baseRevisionId: command.baseRevisionId, on: command.on });
    case "setLineNumbers":
      return setLineNumbers({ documentId, baseRevisionId: command.baseRevisionId, on: command.on });
    case "setCodeContinues":
      return setCodeContinues({ documentId, blockId: command.blockId, baseRevisionId: command.baseRevisionId, continues: command.continues });
    case "setFigure":
      return setFigure({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        ...(command.caption === undefined ? {} : { caption: command.caption }),
        ...(command.captionRuns === undefined ? {} : { captionRuns: command.captionRuns }),
        ...(command.numbered === undefined ? {} : { numbered: command.numbered }),
      });
    case "reviseTable":
      return reviseTable({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        columns: command.columns,
        rows: command.rows,
        ...(command.caption === undefined ? {} : { caption: command.caption }),
      });
    case "reviseReason":
      return reviseRelationReason({ relationId: command.relationId, baseRevisionId: command.baseRevisionId, reason: command.reason });
    case "setRelationState":
      return setRelationState({ relationId: command.relationId, baseRevisionId: command.baseRevisionId, state: command.state });
    case "insert":
      return insertBlock({
        documentId,
        block: command.block,
        placement: command.placement,
      });
    case "insertAdmonitionChild":
      return insertAdmonitionChild({ documentId, parentBlockId: command.parentBlockId, ...(command.afterBlockId === undefined ? {} : { afterBlockId: command.afterBlockId }), runs: command.runs });
    case "mergeAdmonitionChild":
      return mergeAdmonitionChildren({ documentId, parentBlockId: command.parentBlockId, intoBlockId: command.intoBlockId, intoBaseRevisionId: command.intoBaseRevisionId, blockId: command.blockId, baseRevisionId: command.baseRevisionId });
    case "setAdmonitionPattern":
      return setAdmonitionPattern({ documentId, blockId: command.blockId, baseRevisionId: command.baseRevisionId, patternId: command.patternId });
    case "revise":
      return reviseTextBlock({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        runs: command.runs,
        ...(command.role === undefined ? {} : { role: command.role }),
      });
    case "setDisposition":
      return setBlockDisposition({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        standing: command.standing,
      });
    case "split":
      return splitTextBlock({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        at: command.at,
        ...(command.tailBlockId === undefined ? {} : { tailBlockId: command.tailBlockId }),
        ...(command.runs === undefined ? {} : { runs: command.runs }),
        ...(command.role === undefined ? {} : { role: command.role }),
      });
    case "merge":
      return mergeTextBlocks({
        documentId,
        intoBlockId: command.intoBlockId,
        intoBaseRevisionId: command.intoBaseRevisionId,
        blockId: command.blockId,
      });
    case "move":
      return moveBlock({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        placement: command.placement,
      });
    case "rename":
      return renameDocument({
        documentId,
        baseRevisionId: command.baseRevisionId,
        title: command.title,
      });
    case "delete":
      return deleteDocument({
        documentId,
        baseRevisionId: command.baseRevisionId,
      });
    case "retire":
      return retireBlock({ documentId, blockId: command.blockId });
    case "retireBlocks":
      return retireBlocks({ documentId, blocks: command.blocks });
    case "propose":
      return proposeDocumentChanges({
        documentId,
        items: command.items,
      });
    case "reopen":
      return reopenProposal(documentId, command.itemId);
    case "answerProposal":
      return answerDocumentProposal({
        documentId,
        itemId: command.itemId,
        answer: command.answer,
        edited: command.edited === true,
      });
    case "answerGroup":
      return answerDocumentGroup({ documentId, groupId: command.groupId, answer: command.answer });
    case "placeProposal":
      return placeProposedItem({
        documentId,
        itemId: command.itemId,
        placement: command.placement,
      });
    case "moveIn":
      return moveBlockIn({
        documentId,
        fromDocumentId: command.fromDocumentId,
        blockId: command.blockId,
        placement: command.placement,
      });
    case "moveRetired":
      return moveRetiredBlock({
        documentId,
        blockId: command.blockId,
        baseRevisionId: command.baseRevisionId,
        placement: command.placement,
      });
    case "restore":
      return restoreBlock({
        documentId,
        blockId: command.blockId,
        placement: command.placement,
      });
  }
}

async function decode(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/**
 * Every parentless document, as the library lists them. It answers identity
 * and title per document and nothing else, so the drawer never pays for block
 * content it does not render.
 */
export async function handleAdmonitionPatternsRead(): Promise<OutcomeResponse<readonly AdmonitionPattern[]>> {
  return respond(await listAdmonitionPatterns());
}

export async function handleAdmonitionPatternWrite(request: Request, id?: string): Promise<OutcomeResponse<AdmonitionPattern>> {
  const value = await decode(request);
  return respond(id === undefined ? await saveAdmonitionPattern(value) : await updateAdmonitionPattern(id, value));
}

export async function handleDocumentList(
): Promise<OutcomeResponse<readonly DocumentSummary[]>> {
  return respond(await listDocuments());
}

export async function handleDocumentRead(
  documentId: string,
): Promise<OutcomeResponse<DocumentView>> {
  const read = await readDocument(documentId);
  if (read.outcome !== "success") return respond(read);
  // What a guard fixes is drawn by the editor: a title fixed, no Delete.
  // RO_0005_020
  const fixed = await fixedOf(documentId);
  if (fixed.outcome !== "success") return respond(fixed as GraphOutcome<never>);
  const held = fixed.result.undeletable !== undefined || fixed.result.title !== undefined || Object.keys(fixed.result.blocks).length > 0;
  return respond({ outcome: "success", result: held ? { ...read.result, fixed: fixed.result } : read.result });
}

/**
 * When a document last changed and how many times. It is its own read rather
 * than a field on the document, so the panel can refresh the count after a
 * save without paying to read every block again.
 */
export async function handleDocumentChanges(
  documentId: string,
): Promise<OutcomeResponse<ChangeSummary>> {
  return respond(await readDocumentChanges(documentId));
}

/**
 * The proposals standing unanswered against a document. It is its own read, as
 * the change summary is: the panel learns how many are waiting without the
 * document read paying for content nobody has asked to see.
 */
export async function handleProposalsRead(
  documentId: string,
  rejected = false,
): Promise<OutcomeResponse<DocumentProposals>> {
  return respond(await readDocumentProposals(documentId, { rejected }));
}

/** A finished run's document as it stood when the run started, and what the
 * run staged as it was staged, for a replay. BO_0340_007 */
export async function handleReplayRead(documentId: string, runId: string): Promise<OutcomeResponse<ReplayDocument>> {
  return respond(await readReplayDocument(documentId, runId));
}

/** The signed-in person's working mode on a document: read as the document
 * opens, written when a toggle is pressed. BO_0306_011 */
export async function handleWorkingMode(request: Request, documentId: string): Promise<OutcomeResponse<WorkingMode>> {
  if (request.method === "GET") return respond(await readMode(documentId));
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  return respond(await writeMode(documentId, body));
}

export async function handleRetiredRead(
  documentId: string,
): Promise<OutcomeResponse<readonly BlockView[]>> {
  return respond(await readRetiredBlocks(documentId));
}

/**
 * Reads a command and runs it. An unreadable request is refused before any
 * operation starts, so a malformed edit changes nothing.
 */
export async function handleDocumentCommand(
  request: Request,
  documentId: string,
): Promise<OutcomeResponse<unknown>> {
  const body = await decode(request);
  if (body === undefined) {
    return respond(refusal("requestShape", "body is not JSON."));
  }
  const parsed = parseDocumentCommand(body);
  if ("failure" in parsed) {
    return respond(refusal("commandShape", parsed.failure));
  }
  // A command from a tab in a branch names it, and every write of the
  // command stages into it instead of establishing. BO_0250_011
  const branch = text(record(body)?.["branch"]);
  return respond(await withBranch(branch ?? undefined, () => runDocumentCommand(documentId, parsed.command)));
}

/**
 * A file's bytes uploaded by the documents editor: the body is the file, its
 * name in `X-Calliopa-Filename`, percent-encoded. Uploaded through CCGW
 * immediately before the block that references it is written, which is the
 * blob contract. A file CCGW refuses as too large is refused in its words.
 */
export async function handleDocumentFile(request: Request): Promise<OutcomeResponse<{ readonly reference: BlobReference }>> {
  const encoded = request.headers.get("x-calliopa-filename") ?? "";
  let filename = "";
  try {
    filename = decodeURIComponent(encoded).trim();
  } catch {
    return respond(refusal("requestShape", "The file's name is not percent-encoded."));
  }
  if (filename === "") return respond(refusal("requestShape", "The file's name belongs in X-Calliopa-Filename."));
  const mediaType = request.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return respond(refusal("requestShape", `${filename} is empty.`));
  const uploaded = await putBlob(bytes);
  if (uploaded.outcome !== "success") return respond(uploaded as GraphOutcome<never>);
  const objectId = objectIdOfHash(uploaded.result.hash);
  if (objectId === null) return respond(refusal("storage", `CCGW answered a hash this build does not read: ${uploaded.result.hash}.`));
  return respond({
    outcome: "success",
    result: {
      reference: {
        ...blobReference(objectId, mediaType === "" ? "application/octet-stream" : mediaType, uploaded.result.size),
        filename,
      },
    },
  });
}

/** The branch's standing against head, per member. BO_0250_012 */
export async function handleStandingRead(request: Request, documentId: string): Promise<OutcomeResponse<BranchStanding>> {
  const branch = new URL(request.url).searchParams.get("branch") ?? "";
  if (branch === "") return respond(refusal("branchShape", `A standing read names the branch of ${documentId}.`));
  return respond(await readStanding(branch));
}

/** The signed-in person's branch on the document. BO_0250_010 */
export async function handleBranchRead(documentId: string): Promise<OutcomeResponse<BranchOfDocument>> {
  return respond(await branchOf(documentId));
}

/** Whether documents are under separation of duties. BO_0212_011 */
export async function handlePolicyRead(_documentId: string): Promise<OutcomeResponse<DocumentPolicy>> {
  return respond(await documentPolicy());
}

/**
 * Creates a document and its first block. A malformed identifier never reaches
 * a query: Postgres answers a bad uuid with a server error, and a request
 * naming a document that cannot exist is a missing document.
 */
export async function handleDocumentCreate(
  request: Request,
): Promise<OutcomeResponse<CreatedDocument>> {
  const body = await decode(request);
  if (body === undefined) {
    return respond(refusal("requestShape", "body is not JSON."));
  }
  const input = record(body);
  const title = input === null ? null : input["title"];
  if (typeof title !== "string") {
    return respond(refusal("documentShape", "A document carries a title."));
  }
  return respond(await createDocument({ title }));
}

/** A request naming something that is not a record identifier, answered as the
 * missing document it is rather than as a database error. */
export function unknownDocument(id: string): OutcomeResponse<never> {
  return respond({ outcome: "noResult", detail: `No document ${id}.` });
}
