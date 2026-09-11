import { AGENT_FACES } from "./agent-menu";
import { replaceRange, runsLength, type Run } from "./runs";

/**
 * Who proposed a change, and what the reader sees of it: a face on the
 * block's left border, a colour, and names in words. Pure, so the server that
 * reads a group and the editor that draws it cannot disagree about who it
 * was. BO_0233_001 BO_0233_003
 */

/**
 * Who proposed a group. Every agent stages as the one agent account
 * (`BO_0206_008`), so an agent is named from its run's provenance node
 * (`agent.run`, staged into the same group), never from the stamp; a group a
 * person staged carries no such node and is named by the person.
 */
export type Proposer =
  | {
      readonly kind: "agent";
      /** `codex`, `claude-code`, `hermes`, `provider`, or null when no
       * provenance node says which. */
      readonly agent: string | null;
      /** What the run recorded as having reasoned, e.g. `claude-code (claude-sonnet-5)`. */
      readonly executedBy: string;
    }
  | { readonly kind: "person"; readonly name: string };

const AGENT_ACCOUNT = /^agent:/;

/**
 * The proposer of a group from its `agent.run` content, when it has one, and
 * the core's `createdBy` stamps otherwise.
 *
 * A `claude-code` run from before `BO_0228` reasoned through the API-key
 * controller unless its worker was observed delegating, and its provenance
 * says which: `executedBy` begins `provider` when it was not. It is named for
 * what reasoned. A group whose stamps are all people's is a person's; one
 * stamped by an agent account with no provenance node says an agent, and
 * guesses no name.
 */
export function proposerOf(
  run: Readonly<Record<string, unknown>> | undefined,
  stagedBy: readonly string[],
): Proposer {
  if (run !== undefined) {
    const executedBy = typeof run["executedBy"] === "string" ? run["executedBy"] : "";
    let agent = typeof run["agent"] === "string" && run["agent"] !== "" ? run["agent"] : null;
    if (agent === "claude-code" && executedBy.startsWith("provider")) agent = "provider";
    return { kind: "agent", agent, executedBy };
  }
  const people = stagedBy.filter((name) => !AGENT_ACCOUNT.test(name));
  if (people.length > 0 && people.length === stagedBy.length) {
    return { kind: "person", name: people.join(", ") };
  }
  return { kind: "agent", agent: null, executedBy: "" };
}

/** The colour a proposer's block takes: one theme token pair per proposer. */
export type ProposalTone = "codex" | "claude" | "hermes" | "person";

export function toneOf(proposer: Proposer): ProposalTone {
  if (proposer.kind === "person") return "person";
  switch (proposer.agent) {
    case "codex":
      return "codex";
    case "claude-code":
      return "claude";
    // `provider` is Hermes on the API-key model, as the CLI still names it.
    case "hermes":
    case "provider":
      return "hermes";
    default:
      return "person";
  }
}

/** What the face on the left border shows: a character's crop, or a glyph. */
export type ProposalFace =
  | { readonly kind: "image"; readonly src: string }
  | { readonly kind: "icon"; readonly icon: "user" | "robot" };

export function faceOf(proposer: Proposer): ProposalFace {
  if (proposer.kind === "person") return { kind: "icon", icon: "user" };
  switch (proposer.agent) {
    case "codex":
      return { kind: "image", src: AGENT_FACES.codex };
    case "claude-code":
      return { kind: "image", src: AGENT_FACES["claude-code"] };
    case "hermes":
    case "provider":
      return { kind: "image", src: AGENT_FACES.hermes };
    default:
      return { kind: "icon", icon: "robot" };
  }
}

const AGENT_NAMES: Readonly<Record<string, string>> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  hermes: "Hermes",
  provider: "Hermes",
};

/**
 * The proposer in words, with the model it reasoned with when the run said:
 * *Claude Code (claude-sonnet-5)*, *Codex*, *frankzickert*, *an agent*.
 */
export function proposerName(proposer: Proposer): string {
  if (proposer.kind === "person") return proposer.name;
  if (proposer.agent === null) return "an agent";
  const name = AGENT_NAMES[proposer.agent] ?? proposer.agent;
  const model = /\(([^()]+)\)\s*$/.exec(proposer.executedBy)?.[1];
  // A model only a working run could have named; the words a pre-BO_0228
  // record put in parentheses are an explanation, not a model.
  return model !== undefined && !model.includes(" ") ? `${name} (${model})` : name;
}

/** The proposer as the possessive the answer buttons read: *Claude Code's*. */
const possessive = (proposer: Proposer): string => {
  if (proposer.kind === "person") return `${proposer.name}'s`;
  if (proposer.agent === null) return "an agent's";
  return `${AGENT_NAMES[proposer.agent] ?? proposer.agent}'s`;
};

/** What each kind proposes, as the object of *accept* and *reject*. */
const KIND_NOUN: Readonly<Record<string, string>> = {
  replace: "rewrite",
  insert: "new block",
  remove: "removal",
  move: "move",
};

export const kindNoun = (kind: string): string => KIND_NOUN[kind] ?? "change";

/** The accessible names of a proposal and its controls, in words. */
export function proposalNames(
  kind: string,
  proposer: Proposer,
  destination: string | null,
): {
  readonly block: string;
  readonly face: string;
  readonly accept: string;
  readonly reject: string;
  readonly acceptAll: string;
} {
  const who = possessive(proposer);
  const noun = kindNoun(kind);
  const going = destination === null ? "" : `, ${destination}`;
  return {
    block: `Proposed ${noun} by ${proposerName(proposer)}${going}`,
    face: `Proposed by ${proposerName(proposer)}`,
    accept: `Accept ${who} ${noun}`,
    reject: `Reject ${who} ${noun}`,
    acceptAll: `Accept all of ${who} proposed changes`,
  };
}

/** A block among the established ones, as a placement reads it. */
export interface Placed {
  readonly blockId: string;
  readonly order: string;
  /** The block's opening words, for saying where a proposal would go. */
  readonly words: string;
}

/**
 * Where an order key sits among the established blocks, in words: *before
 * «opening words»*, or *at the end*. What a proposal that moves a block says
 * about where accepting would put it, since it is drawn where the block
 * stands (decided 2026-09-10). The block itself is left out of its own
 * neighbours.
 */
export function destinationOf(
  order: string,
  blocks: readonly Placed[],
  self: string,
): string {
  const next = blocks.find((block) => block.blockId !== self && block.order > order);
  return next === undefined ? "would move to the end" : `would move before “${next.words}”`;
}

/** Where a placement asks a proposal to go: before a block, or at the end. */
export type ProposalPlacement = { readonly before: string } | { readonly at: "end" };

/**
 * The placement one arrow press asks for. A proposal sits before the first
 * established block whose key sorts after its own; up moves it before the
 * block ahead of that, down before the block after it, and past the last
 * block is the end. Null when it is already as far as it can go that way.
 */
export function stepPlacement(
  order: string,
  blocks: readonly Placed[],
  self: string,
  direction: -1 | 1,
): ProposalPlacement | null {
  const others = blocks.filter((block) => block.blockId !== self);
  const at = others.findIndex((block) => block.order > order);
  const slot = at < 0 ? others.length : at;
  const next = slot + direction;
  if (next < 0 || next > others.length || next === slot) return null;
  const before = others[next];
  return before === undefined ? { at: "end" } : { before: before.blockId };
}

/**
 * What an input to a proposal's text does to the proposal's own copy of its
 * words, which is handed to the established block once the proposal is
 * accepted: the new runs and where the caret lands. `accept` says whether the
 * input changes the text at all — a history or navigation intent accepts
 * nothing. An input that changes the text but cannot be replayed here (a new
 * paragraph, a format) accepts and applies nothing, and the reader repeats it
 * on the block.
 */
/**
 * How long typing into a proposal pauses before the proposal is accepted and
 * handed to its block: the block editor's save pause, so a reader's words are
 * serialized at the same moment whichever surface took them, and the proposal
 * never turns into the block under a typing hand. BO_0233_014
 */
export const PROPOSAL_PAUSE_MS = 1200;

/** What the reader typed into a proposal, as it stands when it is handed
 * over, and whether they are still typing in it. BO_0233_014 */
export interface TypedProposal {
  readonly runs: Run[];
  readonly start: number;
  readonly end: number;
  readonly focused: boolean;
}

export type HeldEdit =
  | { readonly accept: false }
  | { readonly accept: true; readonly replay: null }
  | { readonly accept: true; readonly replay: { readonly runs: Run[]; readonly at: number } };

export function heldEdit(
  inputType: string,
  data: string | null,
  runs: readonly Run[],
  start: number,
  end: number,
): HeldEdit {
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  const length = runsLength(runs);
  if (inputType.startsWith("history")) return { accept: false };
  if (inputType.startsWith("insert") && inputType !== "insertParagraph" && inputType !== "insertLineBreak") {
    const text = data ?? "";
    if (text === "" && low === high) return { accept: false };
    return { accept: true, replay: { runs: replaceRange(runs, low, high, text), at: low + [...text].length } };
  }
  if (inputType === "deleteContentBackward" || inputType === "deleteContentForward") {
    if (low !== high) return { accept: true, replay: { runs: replaceRange(runs, low, high, ""), at: low } };
    if (inputType === "deleteContentBackward") {
      if (low === 0) return { accept: false };
      return { accept: true, replay: { runs: replaceRange(runs, low - 1, low, ""), at: low - 1 } };
    }
    if (low >= length) return { accept: false };
    return { accept: true, replay: { runs: replaceRange(runs, low, low + 1, ""), at: low } };
  }
  // A new paragraph, a line break, a format or a word deletion: a change the
  // reader meant, which the block itself carries out once it is theirs.
  return { accept: true, replay: null };
}

/** A proposals list, as the editor holds one. */
interface ProposalList {
  readonly unanswered: number;
  readonly groups: readonly { readonly items: readonly { readonly itemId: string }[] }[];
}

/**
 * A proposals list without the named items, its count and its emptied groups
 * following. What keeps an answered proposal from being drawn again by a
 * read that began before its answer: a list is only ever narrowed by what
 * this editor has answered. BO_0233_013
 */
export function withoutItems<T extends ProposalList>(list: T, itemIds: readonly string[]): T {
  if (itemIds.length === 0) return list;
  const groups = list.groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !itemIds.includes(item.itemId)) }))
    .filter((group) => group.items.length > 0);
  return { ...list, groups, unanswered: groups.reduce((sum, group) => sum + group.items.length, 0) };
}

