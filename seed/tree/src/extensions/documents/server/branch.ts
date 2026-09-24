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

/** One of the person's open proposal sessions on a document. CA_0057_009 */
export interface ProposalSession {
  readonly branch: string;
  /** When its first staging minted the group, in epoch milliseconds. */
  readonly since: number;
}

export interface BranchOfDocument {
  /** The name the next session takes: always a free one, even while earlier
   * sessions stand open, since each session is its own proposal. CA_0057_007 */
  readonly branch: string;
  /** The person's open sessions on this document, newest first. CA_0057_009 */
  readonly sessions: readonly ProposalSession[];
  /** The newest closed branch of the person on this document, when there is one. */
  readonly previous?: { readonly branch: string; readonly status: "accepted" | "rejected" };
}

/** The signed-in person's proposal sessions on a document, and the name the
 * next one takes. BO_0250_010 CA_0057_009 */
export async function branchOf(documentId: string): Promise<GraphOutcome<BranchOfDocument>> {
  const account = await signedInAccount();
  if (account.outcome !== "success") return account as GraphOutcome<never>;
  // With history: a group's revision is revised as stagers join it, and its
  // session began at its first. Each prior revision answers as an entry of
  // its own under the same id. A group only moves from open to accepted or
  // rejected, so a closed status on any of its entries is its status.
  // CA_0057_009
  const groups = await query({
    statement: "MATCH (g:ProposalGroup) RETURN GRAPH g INCLUDE HISTORY",
    proposalOverlay: "",
    unbounded: true,
    purpose: "branch lookup",
  });
  if (groups.outcome === "noResult") return { outcome: "success", result: { branch: branchGroupId(documentId, account.result), sessions: [] } };
  if (groups.outcome !== "success") return groups as GraphOutcome<never>;
  const byId = new Map<string, { status: string; since: number }>();
  for (const node of groups.result.nodes) {
    const named = branchGroupOf(node.id);
    if (named === null || named.documentId !== documentId || named.account !== account.result) continue;
    const since = Math.min(node.revision.createdAt, ...(node.history ?? []).map((revision) => revision.createdAt));
    const seen = byId.get(node.id);
    const statuses = [String(node.revision.content?.["status"] ?? ""), ...(node.history ?? []).map((revision) => String(revision.content?.["status"] ?? "")), seen?.status ?? ""];
    const status = statuses.find((value) => value === "accepted" || value === "rejected") ?? (statuses.includes("open") ? "open" : "");
    byId.set(node.id, { status, since: Math.min(since, seen?.since ?? since) });
  }
  // Every branch of the person on this root, by attempt: the open ones are
  // sessions, the next name is past every attempt, and the newest closed one
  // is history. BO_0250_010 CA_0057_007
  const mine = [...byId]
    .map(([id, entry]) => ({ id, status: entry.status, since: entry.since, named: branchGroupOf(id) }))
    .sort((a, b) => (b.named?.attempt ?? 0) - (a.named?.attempt ?? 0));
  const sessions = mine.filter((entry) => entry.status === "open").map((entry) => ({ branch: entry.id, since: entry.since }));
  const branch = branchGroupId(documentId, account.result, (mine[0]?.named?.attempt ?? 0) + 1);
  const closed = mine.find((entry) => entry.status === "accepted" || entry.status === "rejected");
  if (closed === undefined) return { outcome: "success", result: { branch, sessions } };
  return { outcome: "success", result: { branch, sessions, previous: { branch: closed.id, status: closed.status as "accepted" | "rejected" } } };
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
