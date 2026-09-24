import type { RunChip } from "~/components/shell/view-bridge";
import type { DocumentActivity } from "~/server/agent/run-events";
import type { DocumentProposals, ProposedChange } from "../server/documents";
import { faceOf, kindNoun, possessive, proposerName, toneOf, type Proposer } from "./proposals";

/**
 * A revision was a run's when the agent principal wrote it (`BO_0206`). Pure,
 * and here rather than in `server/work.ts` because the editor asks it of a
 * block it has read: a value imported from a server module pulls that module's
 * `node:` imports into the client bundle, which refuses to build.
 */
export const isAgentPrincipal = (createdBy: string): boolean => createdBy.startsWith("agent:");

/**
 * What the reader sees of an agent at work in the document: the one line on
 * a block's bottom border, how long a read's mark stays, and the run chips
 * the composer draws. Pure, so the editor and its tests cannot disagree.
 * BO_0265_010 BO_0265_011 BO_0265_013 BO_0265_014
 */

/** How long a read's mark stays after the last read of its block. */
export const READ_MARK_MS = 3000;

/** The derived words: what the agent does with a block, by operation. */
const DERIVED_WORDS: Readonly<Record<string, string>> = {
  read: "Reading",
  replace: "Proposes a rewrite",
  insert: "Proposes a new block",
  remove: "Proposes removal",
  move: "Proposes a move",
  kind: "Proposes a kind",
  claim: "Proposes a claim",
  relate: "Possible relation",
  reason: "Proposes a reason",
  state: "Proposes a state",
  derive: "Says what it rests on",
  phase: "Proposes a phase",
};

/** The line's words: the agent's own note when it gave one, the derived
 * words otherwise. */
export function markWords(action: string, note?: string): string {
  if (note !== undefined && note.trim() !== "") return note.trim();
  return DERIVED_WORDS[action] ?? "Proposes a change";
}

/** The members an item's decision covers, as its identity carries them. */
const membersOf = (itemId: string): readonly string[] => itemId.split("|").slice(2);

/**
 * An item's words. Its run is still going: the note comes from the staging
 * the run reported. Once the run has ended, from the note its run recorded.
 */
export function itemWords(item: ProposedChange, events: readonly DocumentActivity[], proposer?: Proposer): string {
  const members = new Set(membersOf(item.itemId));
  const live = [...events]
    .reverse()
    .find((event) => event.action !== "read" && event.member !== undefined && members.has(event.member));
  const words = markWords(item.kind, live?.note ?? item.note);
  // A withdrawn item's words are the withdrawer's: whose proposal it is,
  // why it should go, or what supersedes it; a removal or a move withdrawn
  // means the block stays as it stands. A refined and withdrawn item reads
  // as withdrawn. BO_0286_011
  if (item.withdrawal !== undefined) {
    const whose = proposer === undefined ? "the" : possessive(proposer);
    const stays = item.kind === "remove" || item.kind === "move" ? " — the block stays as it stands" : "";
    const why = item.withdrawal.reason !== undefined ? `: ${item.withdrawal.reason}` : item.withdrawal.successor !== undefined ? ", superseded by its replacement" : "";
    return `Proposes to withdraw ${whose} ${kindNoun(item.kind)}${stays}${why}`;
  }
  // A refined item's words are the refiner's, and say whose proposal they
  // refine, so the reader can still see where the words came from.
  // BO_0271_011
  if (item.refinedBy === undefined) return words;
  const whose = proposer === undefined ? "an earlier" : possessive(proposer);
  return `${words}, refining ${whose} ${kindNoun(item.kind)}`;
}

/** Who a mark on an item names: the run's provenance once it has landed,
 * else the agent of that run while it is still going. BO_0271_011 */
function markProposer(mark: { readonly runId: string; readonly proposer: Proposer }, activities: readonly RunActivity[]): Proposer {
  if (mark.proposer.kind !== "agent" || mark.proposer.agent !== null) return mark.proposer;
  const live = activities.find((activity) => activity.runId === mark.runId);
  return live === undefined ? mark.proposer : { kind: "agent", agent: live.agent, executedBy: "" };
}

/** Who proposes an item's withdrawal, when a run did; null otherwise.
 * BO_0286_011 */
export function withdrawerOf(item: ProposedChange, activities: readonly RunActivity[]): Proposer | null {
  return item.withdrawal === undefined ? null : markProposer(item.withdrawal, activities);
}

/** How many standing items name this one as the successor of their
 * withdrawal, which accepting it rejects in the same press. BO_0286_009 */
export function withdrawnCountOf(itemId: string, proposals: DocumentProposals | null): number {
  return (proposals?.groups ?? []).flatMap((group) => group.items).filter((item) => item.withdrawal?.successor === itemId).length;
}

/**
 * Who refined an item, when a run did: the refining run's provenance once it
 * has landed, else the agent of that run while it is still going, which the
 * editor holds in the run's activity; null for an unrefined item.
 * BO_0271_011
 */
export function refinerOf(item: ProposedChange, activities: readonly RunActivity[]): Proposer | null {
  return item.refinedBy === undefined ? null : markProposer(item.refinedBy, activities);
}

/** One block's read mark: its words, when it goes, and the agent of the run
 * that read it, whose face it shows while runs go side by side. BO_0269_018 */
export interface ReadMark {
  readonly words: string;
  readonly until: number;
  readonly agent: string | null;
}

/**
 * The read marks after the run reported more: every block a read named in
 * `fresh` is marked until three seconds from `now`, a block read again
 * keeping its mark three seconds from the new read. A whole-document read
 * marks no block — it shows on the run's chip. Marks whose time has passed
 * are dropped.
 */
export function readMarks(
  marks: Readonly<Record<string, ReadMark>>,
  fresh: readonly DocumentActivity[],
  now: number,
  agent: string | null = null,
): Record<string, ReadMark> {
  const next: Record<string, ReadMark> = {};
  for (const [blockId, mark] of Object.entries(marks)) {
    if (mark.until > now) next[blockId] = mark;
  }
  for (const event of fresh) {
    if (event.action !== "read" || event.scope !== "blocks") continue;
    for (const blockId of event.blocks) next[blockId] = { words: markWords("read", event.note), until: now + READ_MARK_MS, agent };
  }
  return next;
}

/** The group the run staged into, once it has. */
export function liveGroup(events: readonly DocumentActivity[]): string | null {
  return events.find((event) => event.group !== undefined)?.group ?? null;
}

/** The groups the runs still going have staged into: their items appear as
 * they land, so another chip's expansion does not take them away.
 * BO_0265_012 CA_0061_008 */
export function liveGroupsOf(activities: readonly RunActivity[]): string[] {
  return activities.filter((activity) => activity.running).flatMap((activity) => liveGroup(activity.events) ?? []);
}

const PLURALS: Readonly<Record<string, readonly [string, string]>> = {
  replace: ["rewrite", "rewrites"],
  insert: ["insert", "inserts"],
  remove: ["removal", "removals"],
  move: ["move", "moves"],
};

/** What an ended run left to answer, counted by kind: *3 rewrites, 1 insert*. */
export function summaryWords(items: readonly ProposedChange[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = PLURALS[item.kind] === undefined ? "other" : item.kind;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parts = [...counts].map(([kind, count]) => {
    const [one, many] = PLURALS[kind] ?? ["change", "changes"];
    return `${count} ${count === 1 ? one : many}`;
  });
  return parts.join(", ");
}

/** What a running run is doing on the document as a whole. */
export function runningWords(events: readonly DocumentActivity[]): string {
  if (events.some((event) => event.action !== "read")) return "Proposing changes";
  if (events.length > 0) return "Reading the document";
  return "Starting";
}

/** Which changes the view shows: *Show proposed changes*, and the groups a
 * chip showed while it is off or hid while it is on. CA_0055_006 */
export interface ShownChanges {
  readonly proposalsOpen: boolean;
  readonly shownGroups: readonly string[];
  readonly hiddenGroups: readonly string[];
}

/** Whether a change's proposals are shown. */
export function groupShown(groupId: string, shown: ShownChanges): boolean {
  return shown.proposalsOpen ? !shown.hiddenGroups.includes(groupId) : shown.shownGroups.includes(groupId);
}

/** What showing one more change leaves: the group shown beside whatever is
 * shown already, never in its place — a withdrawn proposal's successor is
 * brought into view without taking the withdrawn one away. BO_0286_012 */
export function revealGroup(groupId: string, shown: ShownChanges): Pick<ShownChanges, "shownGroups" | "hiddenGroups"> {
  return shown.proposalsOpen
    ? { shownGroups: shown.shownGroups, hiddenGroups: shown.hiddenGroups.filter((group) => group !== groupId) }
    : { shownGroups: shown.shownGroups.includes(groupId) ? shown.shownGroups : [...shown.shownGroups, groupId], hiddenGroups: shown.hiddenGroups };
}

/** The chip line a press lands on: every group with a chip, newest first, and
 * the groups of the runs still staging into the document. CA_0061_008 */
export interface ChipLine {
  readonly groups: readonly string[];
  readonly live: readonly string[];
}

const ALONE: ChipLine = { groups: [], live: [] };

/**
 * What a chip's press leaves. On a line of one the group is flipped against
 * the toggle, each change shown or hidden on its own (`CA_0055_006`). From the
 * second chip on, one change is read at a time: showing a group hides every
 * other and hiding one leaves none shown, save the group of a run still
 * staging, whose items appear as it stages them (`BO_0265_012`). CA_0061_008
 */
export function toggledGroup(
  groupId: string,
  shown: ShownChanges,
  line: ChipLine = ALONE,
): Pick<ShownChanges, "shownGroups" | "hiddenGroups"> {
  const flip = (groups: readonly string[]) =>
    groups.includes(groupId) ? groups.filter((group) => group !== groupId) : [...groups, groupId];
  if (line.groups.length < 2) {
    return shown.proposalsOpen
      ? { shownGroups: shown.shownGroups, hiddenGroups: flip(shown.hiddenGroups) }
      : { shownGroups: flip(shown.shownGroups), hiddenGroups: shown.hiddenGroups };
  }
  // Hiding is the reader's own press on the chip, so a run still staging is
  // hidden when its own chip asks for it, and kept only from another chip's
  // expansion. CA_0055_006
  if (groupShown(groupId, shown)) {
    return shownAlone(null, shown, { groups: line.groups, live: line.live.filter((group) => group !== groupId) });
  }
  return shownAlone(groupId, shown, line);
}

/**
 * The sets that leave one group shown and every other hidden — or, with no
 * group, none shown at all. A run still staging keeps what it holds either
 * way. CA_0061_008 CA_0061_009 CA_0061_010
 */
export function shownAlone(
  groupId: string | null,
  shown: ShownChanges,
  line: ChipLine,
): Pick<ShownChanges, "shownGroups" | "hiddenGroups"> {
  const others = line.groups.filter((group) => group !== groupId && !line.live.includes(group));
  return shown.proposalsOpen
    ? { shownGroups: shown.shownGroups, hiddenGroups: others }
    : {
        shownGroups: [...line.live.filter((group) => shown.shownGroups.includes(group)), ...(groupId === null ? [] : [groupId])],
        hiddenGroups: shown.hiddenGroups,
      };
}

/** One of the reader's runs as the editor holds it from the bridge; several
 * go side by side. BO_0269_018 */
export interface RunActivity {
  readonly runId: string;
  readonly agent: string | null;
  readonly running: boolean;
  readonly events: readonly DocumentActivity[];
}

/**
 * The run chips of a document: one for each open group a run staged — a
 * command's or a system run's, never a person's branch — newest first, and
 * each of the reader's runs while it is going, even before it has staged,
 * newest first before them. A running chip says what the run is doing; an
 * ended one what it left to answer. BO_0269_018
 */
export function runChipsOf(
  proposals: DocumentProposals | null,
  activities: readonly RunActivity[],
  shown: ShownChanges = { proposalsOpen: true, shownGroups: [], hiddenGroups: [] },
): RunChip[] {
  const running = activities.filter((activity) => activity.running);
  const live = new Set(liveGroupsOf(activities));
  const chip = (
    key: string,
    group: string | null,
    proposer: Proposer,
    text: string,
    ended: boolean,
    count?: number,
  ): RunChip => ({
    key,
    group,
    face: faceOf(proposer),
    tone: toneOf(proposer),
    name: proposerName(proposer),
    text,
    // The number the words count, which a minimized chip draws in their
    // place; a run still going has nothing to answer yet. CA_0061_007
    ...(count === undefined ? {} : { count }),
    ended,
    // A run that has staged nothing has nothing hidden. CA_0055_006
    shown: group === null || groupShown(group, shown),
  });
  const staged = [...(proposals?.groups ?? [])]
    .filter((group) => group.run !== undefined && group.proposer.kind !== "person" && group.items.length > 0)
    .sort((left, right) => (right.run?.stagedAt ?? 0) - (left.run?.stagedAt ?? 0));
  const chips = staged
    .filter((group) => !live.has(group.groupId))
    .map((group) => chip(group.groupId, group.groupId, group.proposer, summaryWords(group.items), true, group.items.length));
  for (const activity of running) {
    const group = liveGroup(activity.events);
    const own = proposals?.groups.find((candidate) => candidate.groupId === group);
    const proposer: Proposer = own?.proposer ?? { kind: "agent", agent: activity.agent, executedBy: "" };
    chips.unshift(chip(group ?? activity.runId, group, proposer, runningWords(activity.events), false));
  }
  return chips;
}
