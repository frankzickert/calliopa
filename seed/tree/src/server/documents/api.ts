import { SCALE, type Standing } from "../../lib/disposition";
import {
  CHANGE_STATUSES,
  isChangeStatus,
  type ChangeStatus,
  type DocumentSummary,
} from "../../lib/library";
import { readRuns, TEXT_ROLES, type Run, type TextRole } from "../../lib/runs";
import type { GraphOutcome, NonEmpty } from "../outcome";
import { refusal, respond, type OutcomeResponse } from "../outcome";
import {
  answerDocumentProposal,
  placeProposedItem,
  createDocument,
  deleteDocument,
  insertBlock,
  listDocuments,
  mergeTextBlocks,
  moveBlock,
  proposeDocumentChanges,
  readDocument,
  readDocumentChanges,
  readDocumentProposals,
  renameDocument,
  setChangeStatus,
  readRetiredBlocks,
  restoreBlock,
  retireBlock,
  reviseTextBlock,
  setBlockDisposition,
  splitTextBlock,
  type AnsweredItem,
  type PlacedItem,
  type ChangeSummary,
  type CreatedDocument,
  type DocumentProposalItem,
  type DocumentProposals,
  type NewBlock,
  type Placement,
  type ProposalAnswer,
  type SplitBlocks,
  type StagedProposal,
  type WrittenBlock,
  type WrittenDocument,
} from "./documents";
import type { BlockView, DocumentView } from "./assemble";

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
  return {
    failure: "A placement names a block to go before or after, or an end.",
  };
}

/** A new block: the two types this build writes, and nothing else. */
function readNewBlock(
  value: unknown,
): { readonly block: NewBlock } | { readonly failure: string } {
  const input = record(value);
  if (input === null) return { failure: "A block is an object." };
  const kind = input["kind"];
  if (kind === "divider") return { block: { kind: "divider" } };
  if (kind !== "text") {
    return { failure: `A new block is text or a divider, not ${String(kind)}.` };
  }
  const role = readRole(input["role"]);
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

function readRole(
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
  | {
      readonly command: "revise";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly runs: readonly Run[];
      readonly role: TextRole | undefined;
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
  | {
      /** A change document's status, from the vocabulary. BO_0222_007 */
      readonly command: "setStatus";
      readonly baseRevisionId: string;
      readonly status: ChangeStatus;
    }
  | { readonly command: "delete"; readonly baseRevisionId: string }
  | { readonly command: "retire"; readonly blockId: string }
  | {
      readonly command: "propose";
      readonly items: NonEmpty<DocumentProposalItem>;
    }
  | {
      readonly command: "answerProposal";
      readonly itemId: string;
      readonly answer: ProposalAnswer;
      /** An edit's acceptance, over what the block did since. CA_0042_002 */
      readonly edited?: boolean;
    }
  | {
      readonly command: "placeProposal";
      readonly itemId: string;
      readonly placement: Placement;
    }
  | {
      readonly command: "restore";
      readonly blockId: string;
      readonly placement: Placement;
    };

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
    case "revise": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A revise names a block and the revision it is based on." };
      }
      const runs = readRuns(input["runs"]);
      if ("failure" in runs) return runs;
      const role = readRole(input["role"]);
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
    case "setDisposition": {
      if (blockId === null || baseRevisionId === null) {
        return { failure: "A standing names a block and the revision it is based on." };
      }
      // Neutral is named rather than left out, so a body that forgot the
      // field is refused rather than read as clearing the block's standing.
      const standing = input["standing"];
      if (typeof standing !== "string" || !(SCALE as readonly string[]).includes(standing)) {
        return { failure: `A standing is one of ${SCALE.join(", ")}.` };
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
      return { command: { command: "split", blockId, baseRevisionId, at } };
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
    case "setStatus": {
      if (baseRevisionId === null) {
        return {
          failure: "A status change names the document revision it is based on.",
        };
      }
      const status = input["status"];
      if (!isChangeStatus(status)) {
        return {
          failure: `A status is one of ${CHANGE_STATUSES.join(", ")}.`,
        };
      }
      return { command: { command: "setStatus", baseRevisionId, status } };
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
  const role = readRole(input["role"]);
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
    WrittenBlock | SplitBlocks | WrittenDocument | AnsweredItem | StagedProposal | PlacedItem
  >
> {
  switch (command.command) {
    case "insert":
      return insertBlock({
        documentId,
        block: command.block,
        placement: command.placement,
      });
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
    case "setStatus":
      return setChangeStatus({
        documentId,
        baseRevisionId: command.baseRevisionId,
        status: command.status,
      });
    case "delete":
      return deleteDocument({
        documentId,
        baseRevisionId: command.baseRevisionId,
      });
    case "retire":
      return retireBlock({ documentId, blockId: command.blockId });
    case "propose":
      return proposeDocumentChanges({
        documentId,
        items: command.items,
      });
    case "answerProposal":
      return answerDocumentProposal({
        documentId,
        itemId: command.itemId,
        answer: command.answer,
        edited: command.edited === true,
      });
    case "placeProposal":
      return placeProposedItem({
        documentId,
        itemId: command.itemId,
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
export async function handleDocumentList(
): Promise<OutcomeResponse<readonly DocumentSummary[]>> {
  return respond(await listDocuments());
}

export async function handleDocumentRead(
  documentId: string,
): Promise<OutcomeResponse<DocumentView>> {
  return respond(await readDocument(documentId));
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
): Promise<OutcomeResponse<DocumentProposals>> {
  return respond(await readDocumentProposals(documentId));
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
  return respond(await runDocumentCommand(documentId, parsed.command));
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
  // A change document names its extension and may name a status; a status
  // without an extension is not a shape a document has. BO_0222_005
  const change = input === null ? undefined : input["change"];
  const status = input === null ? undefined : input["status"];
  if (change !== undefined && (typeof change !== "string" || change === "")) {
    return respond(refusal("documentShape", "A change names the extension it is a change of."));
  }
  if (status !== undefined && !isChangeStatus(status)) {
    return respond(refusal("documentShape", `A status is one of ${CHANGE_STATUSES.join(", ")}.`));
  }
  if (status !== undefined && change === undefined) {
    return respond(refusal("documentShape", "A status belongs to a change document."));
  }
  return respond(
    await createDocument({
      title,
      ...(typeof change === "string" ? { change } : {}),
      ...(isChangeStatus(status) ? { status } : {}),
    }),
  );
}

/** A request naming something that is not a record identifier, answered as the
 * missing document it is rather than as a database error. */
export function unknownDocument(id: string): OutcomeResponse<never> {
  return respond({ outcome: "noResult", detail: `No document ${id}.` });
}
