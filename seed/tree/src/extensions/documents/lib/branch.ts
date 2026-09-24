import type { RunChip } from "~/components/shell/view-bridge";
import type { BlockView, DocumentView } from "../../documents/server/assemble";
import { groupShown, type ShownChanges } from "./agent-at-work";

/**
 * A proposal branch as the shell reads it (`BO_0250`): an ordinary open
 * proposal group the person stages into, one per proposal session, offered on
 * any document the person can edit. Everything decided here is pure — what a
 * session's chip says, what a member's standing reads as, what the acceptance
 * card offers, what a rejected branch held — so the chips, the card and the
 * client calls cannot disagree. Nothing here writes.
 */

/** One of the person's open proposal sessions: its group, and when its
 * first staging minted it. CA_0057_009 */
export interface ProposalSession {
  readonly branch: string;
  readonly since: number;
}

/** The branch read: the name the next session takes, and the person's open
 * sessions on the document, newest first. CA_0057_007 CA_0057_009 */
export interface BranchRead {
  readonly branch: string;
  readonly sessions: readonly ProposalSession[];
}

export type MemberStanding = "clean" | "autoCorrected" | "drifted";

export interface StandingMember {
  readonly ref: string;
  readonly kind: string;
  readonly standing: MemberStanding;
}

/** The standing read (`GET documents/[id]/standing?branch=`). */
export interface Standing {
  readonly proposal: string;
  readonly status: string;
  readonly base: number;
  readonly head: number;
  readonly members: readonly StandingMember[];
}

/** What a session's chip says before its time. */
export const BRANCH_WORDS = "Proposal · yours";

/** A session's chip in words: *Proposal · yours · 14:32*, the local time its
 * session began. CA_0057_008 */
export function sessionWords(since: number): string {
  const at = new Date(since);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${BRANCH_WORDS} · ${two(at.getHours())}:${two(at.getMinutes())}`;
}

/**
 * The chips of the person's own proposal sessions, newest first: the
 * answers stand at once, since a session has no run to wait for; a chip is
 * shown as a run's is — the toggle sets them all, its press flips its own —
 * and always while the tab works in it, which it is `working`; under
 * separation of duties someone else accepts it. CA_0057_008 CA_0057_010
 * CA_0057_014
 */
export function sessionChipsOf(
  sessions: readonly ProposalSession[],
  working: string | null,
  required: boolean,
  shown: ShownChanges = { proposalsOpen: true, shownGroups: [], hiddenGroups: [] },
  /** The open changes each group holds, for the number a minimized chip
   * draws in place of its words. CA_0061_007 */
  counts: ReadonlyMap<string, number> = new Map(),
): RunChip[] {
  return [...sessions]
    .sort((left, right) => right.since - left.since)
    .map((session) => ({
      key: session.branch,
      group: session.branch,
      face: { kind: "icon", icon: "user" },
      tone: "person",
      name: "you",
      text: sessionWords(session.since),
      count: counts.get(session.branch) ?? 0,
      ended: true,
      shown: session.branch === working || groupShown(session.branch, shown),
      session: true,
      working: session.branch === working,
      ...(required ? { accepts: "others" as const } : {}),
    }));
}

/** What a member's standing reads as on the card. */
export function standingWords(standing: MemberStanding): string {
  switch (standing) {
    case "clean":
      return "unchanged";
    case "autoCorrected":
      return "moved beneath it, corrected on acceptance";
    case "drifted":
      return "moved under it: keep yours, drop it, or rewrite it";
  }
}

/**
 * Whether a member is a run's record rather than a change: a run that proposes
 * into the branch stages its `agent.run` provenance node there as `run:<id>`.
 * It is no item and no change to choose about, but it is a member, so the
 * branch closes only once it is answered too. Found on the served build in
 * the BO_0250 walk, 2026-09-16, when a branch a run proposed into stayed open
 * after every item was rejected and the next branch could not be named.
 */
export const isRunRecord = (ref: string): boolean => ref.startsWith("node:run:");

/** The run records among a standing's members. */
export const runRecordsOf = (standing: Standing | null): readonly string[] =>
  (standing?.members ?? []).map((member) => member.ref).filter(isRunRecord);

/** Whether acceptance has a choice to ask for: a member drifted. */
export const hasDrifted = (standing: Standing | null): boolean =>
  standing !== null && standing.members.some((member) => member.standing === "drifted");

/** What the person chose for a drifted member: their words over the drift, or the member dropped. */
export type DriftChoice = "keep" | "drop";

export interface AcceptanceReading {
  readonly question: string;
  /** What the card says of the branch's standing, or that it is reading it. */
  readonly lead: string;
  readonly members: readonly {
    readonly ref: string;
    readonly words: string;
    readonly standing: MemberStanding;
    /** Set on a drifted member once the person chose. */
    readonly choice: DriftChoice | null;
  }[];
  /** Whether *Accept* stands. */
  readonly accept: boolean;
  readonly note: string | null;
  readonly waiting: boolean;
}

export const ACCEPT_QUESTION = "Accept this proposal?";

/**
 * The acceptance card, decided once from the standing read and the person's
 * choices (`BO_0250_021`): reading while the standing is on its way; *Accept*
 * at once when nothing accepted moved under a member; with a member drifted,
 * *Accept* only once every drifted member is kept or dropped — a rewrite in
 * the branch makes the member clean again on the next read. No run is asked
 * (`BO_0250`, Decided 2026-09-16).
 */
export function acceptanceReading(input: {
  readonly standing: Standing | null;
  readonly choices: Readonly<Record<string, DriftChoice>>;
  /** A refused standing read. */
  readonly failure?: string | null;
}): AcceptanceReading {
  const { standing, choices } = input;
  const members = (standing?.members ?? []).filter((member) => !isRunRecord(member.ref)).map((member) => ({
    ref: member.ref,
    words: standingWords(member.standing),
    standing: member.standing,
    choice: member.standing === "drifted" ? (choices[member.ref] ?? null) : null,
  }));
  const base = { question: ACCEPT_QUESTION, members, note: null as string | null };
  if (input.failure != null && input.failure !== "") return { ...base, lead: input.failure, accept: false, waiting: false };
  if (standing === null) return { ...base, lead: "Reading how this proposal stands against what is accepted…", accept: false, waiting: true };
  if (members.length === 0) return { ...base, lead: "Nothing is in this proposal yet.", accept: false, waiting: false };
  if (!members.some((member) => member.standing === "drifted")) return { ...base, lead: "Nothing accepted moved under this proposal.", accept: true, waiting: false };
  const open = members.some((member) => member.standing === "drifted" && member.choice === null);
  return {
    ...base,
    lead: "Accepted work moved under part of this proposal.",
    accept: !open,
    note: open ? "Keep your words, drop the member, or rewrite the block in the proposal first." : null,
    waiting: false,
  };
}

/** The proposals read's shape the branch needs: a group's id, its proposer and its items. */
export interface BranchGroup {
  readonly groupId: string;
  readonly items: readonly { readonly itemId: string; readonly blockId: string; readonly kind: string }[];
}

/** The branch's items, as the proposals read lists its group; empty when the group is not listed. */
export function branchItemsOf(proposals: { readonly groups: readonly BranchGroup[] } | null | undefined, branch: string | null): BranchGroup["items"] {
  if (proposals == null || branch === null) return [];
  return proposals.groups.find((group) => group.groupId === branch)?.items ?? [];
}

/** The branch member a block is, or null when the block is truth's alone. */
export function memberOf(items: BranchGroup["items"], blockId: string): BranchGroup["items"][number] | null {
  return items.find((item) => item.blockId === blockId && item.kind !== "phase") ?? null;
}

/**
 * What a rejected branch held that truth does not: its blocks that differ
 * from truth or are absent from it, each a candidate for promotion on its
 * own (material §25). Dividers carry nothing to promote.
 */
export function rejectedEntries(truth: DocumentView, overlay: DocumentView): readonly BlockView[] {
  const byId = new Map(truth.blocks.map((block) => [block.blockId, block]));
  return overlay.blocks.filter((block) => {
    if (block.kind !== "text") return false;
    const current = byId.get(block.blockId);
    if (current === undefined) return true;
    if (current.kind !== "text") return true;
    return current.revisionId !== block.revisionId && JSON.stringify(current.runs) !== JSON.stringify(block.runs);
  });
}
