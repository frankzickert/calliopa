import type { ProposalPlacement } from "../lib/proposals";
import { type BranchRead, type Standing } from "~/extensions/documents/lib/branch";
import { withBranch, withBranchBody } from "../lib/branch-scope";
import type {
  ChangeSummary,
  DocumentProposals,
} from "../server/documents";
import type { DocumentView, BlockView } from "../server/assemble";
import type { ReadMark } from "../server/read-mark";
import type { GraphOutcome } from "~/server/outcome";
import type { BlobReference } from "~/server/ccgw/blobs";

/**
 * The block editor's calls to the documents API, and what a failed one means
 * to the person who was typing. Its own module so the editor and the hooks it
 * composes (`marking/`, `standing/`) send commands the same way. Moved out of
 * the editor's component file with `BO_0227_010`, unchanged.
 */

/** What a failed outcome means to the person who was typing. */
/** The core's codes for separation of duties, as a refusal's words carry them
 * (`ccgw.md` §15). BO_0212_011 BO_0212_012 */
export const SEPARATION_REQUIRES_PROPOSAL = "separation_of_duties_requires_proposal";
export const SEPARATION_REFUSED = "separation_of_duties_refused";

/** Whether a refusal is the core's separation-of-duties refusal of a direct
 * write: the document is reviewed by someone else now. */
export const requiresProposal = (outcome: GraphOutcome<unknown>): boolean =>
  outcome.outcome !== "success" && describeRaw(outcome).includes(SEPARATION_REQUIRES_PROPOSAL);

function describeRaw(outcome: GraphOutcome<unknown>): string {
  switch (outcome.outcome) {
    case "validationFailure":
      return outcome.failures.map((failure) => `${failure.rule} ${failure.detail}`).join(" ");
    case "noResult":
    case "storageError":
    case "refused":
      return outcome.detail;
    default:
      return "";
  }
}

/**
 * The kernel's per-node write floor: a second write to one node inside 250ms
 * of the first is refused as `write_too_frequent`, on the ground that
 * coalescing edits is the editor's job (`calliopa-bootstrap`'s `ui-kernel.md`,
 * `BO_0134_001`). A gesture that legitimately writes a node twice in a
 * breath — a second Enter, a standing after a save — waits this long before
 * its second write, the wait the server's `commitEach` takes for the same
 * reason. DO_0015_002 DO_0015_003
 */
export const WRITE_FLOOR_MS = 300;

/** Whether a refusal is the floor's: the write was sound and is sent again
 * after the floor, never folded back or named on the block. */
export const refusedByFloor = (outcome: GraphOutcome<unknown>): boolean =>
  outcome.outcome === "validationFailure" && outcome.failures.some((failure) => failure.rule === "write_too_frequent");

/** Waits the floor out. */
export const afterFloor = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, WRITE_FLOOR_MS));

export function describeOutcome(outcome: GraphOutcome<unknown>): string {
  // An acceptance by someone who staged or asked for the proposal is said as
  // what it is, not as the core's code. BO_0212_012
  if (outcome.outcome !== "success" && describeRaw(outcome).includes(SEPARATION_REFUSED)) {
    return "Someone else has to accept this: you proposed it, or asked an agent to.";
  }
  switch (outcome.outcome) {
    case "success":
      return "";
    case "conflict":
      return "This block changed somewhere else. Reload the document to see its current text before editing it again.";
    case "validationFailure":
      return outcome.failures[0].detail;
    case "noResult":
      return outcome.detail;
    case "storageError":
      return outcome.detail;
    case "authenticationFailure":
      return "This workspace is no longer signed in.";
    case "refused":
      return outcome.detail;
  }
}

export async function readOutcome<T>(
  response: Response,
): Promise<GraphOutcome<T>> {
  try {
    return (await response.json()) as GraphOutcome<T>;
  } catch {
    return { outcome: "storageError", detail: "The server sent no answer." };
  }
}

export const fetchDocument = async (
  id: string,
): Promise<GraphOutcome<DocumentView>> =>
  readOutcome<DocumentView>(await fetch(withBranch(`/api/x/documents/d/${id}`, id)));

export const fetchRetired = async (
  id: string,
): Promise<GraphOutcome<readonly BlockView[]>> =>
  readOutcome<readonly BlockView[]>(
    await fetch(`/api/x/documents/d/${id}/retired`),
  );

/** The reader's mark on the document, read with it. BO_0246_007 */
export const fetchReadMark = async (id: string): Promise<GraphOutcome<ReadMark>> =>
  readOutcome<ReadMark>(await fetch(`/api/x/documents/d/${id}/read`));

/** Writes the mark: the derived blocks were in view at this data revision.
 * `keepalive` for the write made as the tab is left. BO_0246_007 */
export const sendReadMark = async (id: string, dataRevision: number, keepalive = false): Promise<GraphOutcome<ReadMark>> =>
  readOutcome<ReadMark>(
    await fetch(`/api/x/documents/d/${id}/read`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataRevision }),
      keepalive,
    }),
  );

export interface WriteResult {
  readonly blockId: string;
  readonly revisionId: string;
  readonly tailBlockId?: string;
  /** A split's tail as it was established. CA_0045_004 */
  readonly tailRevisionId?: string;
}

export const sendCommand = async (
  id: string,
  command: Record<string, unknown>,
  keepalive = false,
): Promise<GraphOutcome<WriteResult>> =>
  readOutcome<WriteResult>(
    await fetch(`/api/x/documents/d/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withBranchBody(command, id)),
      keepalive,
    }),
  );

/** The bytes of a `.csv` or `.tsv` a table stands behind, uploaded before the
 * block that references them is written; the answer is the reference the
 * insert carries. BO_0287_013 */
export const uploadTableFile = async (
  file: File,
): Promise<GraphOutcome<{ readonly reference: BlobReference }>> =>
  readOutcome<{ readonly reference: BlobReference }>(
    await fetch(`/api/x/documents/blobs`, {
      method: "POST",
      headers: {
        "content-type": file.type === "" ? "text/csv" : file.type,
        "x-calliopa-filename": encodeURIComponent(file.name),
      },
      body: file,
    }),
  );

export const sendRename = async (
  id: string,
  baseRevisionId: string,
  title: string,
): Promise<GraphOutcome<{ revisionId: string }>> =>
  readOutcome<{ revisionId: string }>(
    await fetch(`/api/x/documents/d/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withBranchBody({ command: "rename", baseRevisionId, title }, id)),
    }),
  );

/** Sets the root's phase as the reader: the document node revised alone with
 * the base compared first, `supersede` naming the accepted root the press
 * supersedes in the same mutation. The press is the confirmation. BO_0249 */
export const sendPhase = async (
  id: string,
  baseRevisionId: string,
  phase: string,
  supersede: string | null,
): Promise<GraphOutcome<{ revisionId: string }>> =>
  readOutcome<{ revisionId: string }>(
    await fetch(`/api/x/documents/d/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withBranchBody({ command: "setDocumentPhase", baseRevisionId, phase, ...(supersede === null ? {} : { supersede }) }, id)),
    }),
  );

export const fetchChanges = async (
  id: string,
): Promise<GraphOutcome<ChangeSummary>> =>
  readOutcome<ChangeSummary>(
    await fetch(`/api/x/documents/d/${id}/changes`),
  );

export const fetchProposals = async (
  id: string,
): Promise<GraphOutcome<DocumentProposals>> =>
  readOutcome<DocumentProposals>(
    await fetch(withBranch(`/api/x/documents/d/${id}/proposals`, id)),
  );

/** Moves a proposed change to another place without answering it. BO_0233_007 */
export const placeProposal = async (
  id: string,
  itemId: string,
  placement: ProposalPlacement,
): Promise<GraphOutcome<unknown>> =>
  readOutcome(
    await fetch(`/api/x/documents/d/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withBranchBody({ command: "placeProposal", itemId, placement }, id)),
    }),
  );

/** Answers a proposed change. `edited` says the reader typed into it, which
 * accepts a rewrite over what its block did since. CA_0042_002 */
export const answerProposal = async (
  id: string,
  itemId: string,
  answer: "accepted" | "rejected",
  edited = false,
): Promise<GraphOutcome<{ readonly withdrawn?: number; readonly notice?: string }>> =>
  readOutcome<{ readonly withdrawn?: number; readonly notice?: string }>(
    await fetch(`/api/x/documents/d/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withBranchBody({ command: "answerProposal", itemId, answer, ...(edited ? { edited } : {}) }, id)),
    }),
  );

/** The person's branch on the document and whether it is open. BO_0250_010 */
export const fetchBranch = async (id: string): Promise<GraphOutcome<BranchRead>> =>
  readOutcome<BranchRead>(await fetch(`/api/x/documents/d/${id}/branch?account=me`));

/** Whether every edit of a document goes into the person's proposal. BO_0212_011 */
export const fetchPolicy = async (id: string): Promise<GraphOutcome<{ readonly required: boolean }>> =>
  readOutcome<{ readonly required: boolean }>(await fetch(`/api/x/documents/d/${id}/policy`));

/** The branch's standing against head, per member. BO_0250_021 */
export const fetchStanding = async (id: string, branch: string): Promise<GraphOutcome<Standing>> =>
  readOutcome<Standing>(await fetch(`/api/x/documents/d/${id}/standing?branch=${encodeURIComponent(branch)}`));

/** Restages one block of a rejected branch into a new group of the person's. BO_0250_022 */
export const sendPromote = async (id: string, group: string, blockId: string): Promise<GraphOutcome<{ group: string }>> =>
  readOutcome<{ group: string }>(
    await fetch(`/api/x/documents/d/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "promoteBlock", group, blockId }),
    }),
  );

/** The document as a named group holds it — a rejected branch's history. BO_0250_022 */
export const fetchDocumentIn = async (id: string, group: string): Promise<GraphOutcome<DocumentView>> =>
  readOutcome<DocumentView>(await fetch(withBranch(`/api/x/documents/d/${id}`, id, group)));
