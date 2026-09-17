import { branchGroupId, branchGroupOf } from "~/server/ccgw/branch-scope";
import { query, standing, type Standing } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import { readSession } from "~/server/session";
import { readSeparation } from "~/server/graph-gateway";

/**
 * The shell's side of a person's branch (`BO_0250_012`): the core's standing
 * read it wraps, and the person's own branch on a document, looked up by its
 * name. The branch itself is an ordinary open proposal group the person
 * stages into as human class (`block-document-model.md`, Proposal Branches).
 */

/** Who the request is signed in as, or a refusal when nobody is. */
export async function signedInAccount(): Promise<GraphOutcome<string>> {
  const person = await readSession();
  if (person === null) return { outcome: "refused", detail: "A branch belongs to a signed-in person." };
  return { outcome: "success", result: person.name };
}

export interface BranchOfDocument {
  /** The open branch, or the name the next branch takes. */
  readonly branch: string;
  readonly status: "open" | "accepted" | "rejected" | "none";
  /** The newest closed branch of the person on this document, when there is one. */
  readonly previous?: { readonly branch: string; readonly status: "accepted" | "rejected" };
}

/** The signed-in person's branch on a document and the group's state. BO_0250_010 */
export async function branchOf(documentId: string): Promise<GraphOutcome<BranchOfDocument>> {
  const account = await signedInAccount();
  if (account.outcome !== "success") return account as GraphOutcome<never>;
  const groups = await query({
    statement: "MATCH (g:ProposalGroup) RETURN GRAPH g",
    proposalOverlay: "",
    unbounded: true,
    purpose: "branch lookup",
  });
  if (groups.outcome === "noResult") return { outcome: "success", result: { branch: branchGroupId(documentId, account.result), status: "none" } };
  if (groups.outcome !== "success") return groups as GraphOutcome<never>;
  // Every branch of the person on this root, by attempt: the open one is the
  // branch; otherwise the next name is free and the newest closed one is
  // history. BO_0250_010
  const mine = groups.result.nodes
    .map((node) => ({ id: node.id, status: String(node.revision.content?.["status"] ?? ""), named: branchGroupOf(node.id) }))
    .filter((entry) => entry.named !== null && entry.named.documentId === documentId && entry.named.account === account.result)
    .sort((a, b) => (b.named?.attempt ?? 0) - (a.named?.attempt ?? 0));
  const open = mine.find((entry) => entry.status === "open");
  if (open !== undefined) return { outcome: "success", result: { branch: open.id, status: "open" } };
  const newest = mine[0];
  const next = branchGroupId(documentId, account.result, (newest?.named?.attempt ?? 0) + 1);
  if (newest === undefined || (newest.status !== "accepted" && newest.status !== "rejected")) {
    return { outcome: "success", result: { branch: next, status: "none" } };
  }
  return { outcome: "success", result: { branch: next, status: "none", previous: { branch: newest.id, status: newest.status } } };
}

export type BranchStanding = Standing;

/**
 * The branch's standing against head, per member; a branch nothing has been
 * staged into yet stands with no members rather than as a missing proposal.
 * BO_0250_002 BO_0250_012
 */
export async function readStanding(branch: string): Promise<GraphOutcome<BranchStanding>> {
  const judged = await standing(branch);
  if (judged.outcome === "noResult") return { outcome: "success", result: { proposal: branch, status: "none", base: 0, head: 0, members: [] } };
  return judged;
}

/** Whether documents are under separation of duties. */
export interface DocumentPolicy {
  /** Every edit of a document goes into its person's proposal, and someone
   * else accepts it. BO_0212_011 */
  readonly required: boolean;
}

/** How long a read of the policy stands before the schema is asked again: an
 * editor asks on every document it opens, and the owner's change reaches a
 * refused save at once anyway. */
const POLICY_TTL_MS = 10_000;
let policyRead: { readonly at: number; readonly required: boolean } | null = null;

/** Whether `documents` is under separation of duties, from the core's schema.
 * A schema that cannot be read answers not required: the core still refuses
 * every truth write, and the refused save enters the proposal. BO_0212_011 */
export async function documentPolicy(): Promise<GraphOutcome<DocumentPolicy>> {
  const now = Date.now();
  if (policyRead === null || now - policyRead.at > POLICY_TTL_MS) {
    const set = await readSeparation();
    policyRead = { at: now, required: set.ok && set.value.includes("documents") };
  }
  return { outcome: "success", result: { required: policyRead.required } };
}
