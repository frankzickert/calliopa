import type {
  ChangeSummary,
  DocumentProposals,
} from "~/server/documents/documents";
import type { DocumentView, BlockView } from "~/server/documents/assemble";
import type { GraphOutcome } from "~/server/outcome";

/**
 * The block editor's calls to the documents API, and what a failed one means
 * to the person who was typing. Its own module so the editor and the hooks it
 * composes (`marking/`, `standing/`) send commands the same way. Moved out of
 * the editor's component file with `BO_0227_010`, unchanged.
 */

/** What a failed outcome means to the person who was typing. */
export function describeOutcome(outcome: GraphOutcome<unknown>): string {
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
  readOutcome<DocumentView>(await fetch(`/api/x/ui.shell/documents/${id}`));

export const fetchRetired = async (
  id: string,
): Promise<GraphOutcome<readonly BlockView[]>> =>
  readOutcome<readonly BlockView[]>(
    await fetch(`/api/x/ui.shell/documents/${id}/retired`),
  );

export interface WriteResult {
  readonly blockId: string;
  readonly revisionId: string;
  readonly tailBlockId?: string;
}

export const sendCommand = async (
  id: string,
  command: Record<string, unknown>,
  keepalive = false,
): Promise<GraphOutcome<WriteResult>> =>
  readOutcome<WriteResult>(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
      keepalive,
    }),
  );

export const sendRename = async (
  id: string,
  baseRevisionId: string,
  title: string,
): Promise<GraphOutcome<{ revisionId: string }>> =>
  readOutcome<{ revisionId: string }>(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "rename", baseRevisionId, title }),
    }),
  );

/** Sets a change document's status: the document node revised alone, with
 * the base the editor holds compared first. BO_0222_007 */
export const sendStatus = async (
  id: string,
  baseRevisionId: string,
  status: string,
): Promise<GraphOutcome<{ revisionId: string }>> =>
  readOutcome<{ revisionId: string }>(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "setStatus", baseRevisionId, status }),
    }),
  );

export const fetchChanges = async (
  id: string,
): Promise<GraphOutcome<ChangeSummary>> =>
  readOutcome<ChangeSummary>(
    await fetch(`/api/x/ui.shell/documents/${id}/changes`),
  );

export const fetchProposals = async (
  id: string,
): Promise<GraphOutcome<DocumentProposals>> =>
  readOutcome<DocumentProposals>(
    await fetch(`/api/x/ui.shell/documents/${id}/proposals`),
  );

/** Moves a proposed change to another place without answering it. BO_0233_007 */
export const placeProposal = async (
  id: string,
  itemId: string,
  placement: { readonly before: string } | { readonly at: "end" },
): Promise<GraphOutcome<unknown>> =>
  readOutcome(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "placeProposal", itemId, placement }),
    }),
  );

/** Answers a proposed change. `edited` says the reader typed into it, which
 * accepts a rewrite over what its block did since. CA_0042_002 */
export const answerProposal = async (
  id: string,
  itemId: string,
  answer: "accepted" | "rejected",
  edited = false,
): Promise<GraphOutcome<unknown>> =>
  readOutcome(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "answerProposal", itemId, answer, ...(edited ? { edited } : {}) }),
    }),
  );
