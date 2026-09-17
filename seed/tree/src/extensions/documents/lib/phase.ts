/**
 * A root's phase as the shell reads it (`BO_0249`): proposed, accepted or
 * superseded — a fact the graph holds on the document, named `phase` because
 * `state` is the document's derived refinement state (`BO_0248`) — and the
 * decisions the surfaces draw from it, pure, so the marker under the intent,
 * the transition card and the policy hook cannot disagree: what the marker
 * says, whether it is a control, what the card lists as the consequences of
 * accepting, and which control the signed-in person sees. Nothing here
 * writes; the one write is the press on *Establish*, which is the deliberate
 * confirmation (`BO_0249`, Decided).
 */

export const PHASES = ["proposed", "accepted", "superseded"] as const;
export type Phase = (typeof PHASES)[number];
export const isPhase = (value: unknown): value is Phase =>
  typeof value === "string" && (PHASES as readonly string[]).includes(value);

/** What the marker and the card need of the document. */
export interface PhasedDocument {
  readonly phase?: string;
  readonly supersededBy?: string;
  /** Set on a change document, which carries no phase: its `changeStatus` is
   * its lifecycle (user decision, 2026-09-15). */
  readonly change?: string;
}

/**
 * The root's phase, or null where the document carries none: a change
 * document has its status and never a phase. Absent reads as proposed.
 */
export function phaseOf(document: PhasedDocument): Phase | null {
  if (document.change !== undefined) return null;
  return isPhase(document.phase) ? document.phase : "proposed";
}

/** The marker's words: *Proposed*, *Accepted*, *Superseded by «title»*. */
export function phaseWords(phase: Phase, successorTitle: string | null = null): string {
  switch (phase) {
    case "proposed":
      return "Proposed";
    case "accepted":
      return "Accepted";
    case "superseded":
      return successorTitle === null || successorTitle === "" ? "Superseded" : `Superseded by ${successorTitle}`;
  }
}

/** One consequence of accepting the root, as the consequences read answers it. */
export interface ConsequenceItem {
  readonly kind: "constrains" | "supports" | "contradicts" | "supersedes" | "judgement";
  readonly words: string;
  readonly documentId?: string;
  readonly documentTitle?: string;
  readonly blockId?: string;
  readonly relationId?: string;
}

/** The consequences read (`GET documents/[id]/consequences`, `BO_0249_007`). */
export interface Consequences {
  readonly documentId: string;
  readonly phase: string;
  readonly supersededBy?: string;
  /** Whether the signed-in person may establish under the root's policy. */
  readonly permitted: boolean;
  /** The policy the root answers to: `owner` today. */
  readonly policy: string;
  /** Accepted roots that contradict this one on a declared relation. */
  readonly conflicts: readonly { readonly documentId: string; readonly title: string }[];
  readonly items: readonly ConsequenceItem[];
}

const VERBS: Readonly<Record<ConsequenceItem["kind"], string>> = {
  constrains: "constrain",
  supports: "support",
  contradicts: "contradict",
  supersedes: "supersede",
  judgement: "reopen",
};

/**
 * One consequence in words: the relation's verb, the far block's opening
 * words and its document where it is another's — *constrain «words» in
 * «title»* — and a standing judgement as *reopen: «words»*.
 */
export function consequenceWords(item: ConsequenceItem, here?: string): string {
  const verb = VERBS[item.kind];
  if (item.kind === "judgement") return `${verb}: ${item.words}`;
  const elsewhere =
    item.documentTitle !== undefined && item.documentTitle !== "" && item.documentId !== here ? ` in ${item.documentTitle}` : "";
  return `${verb} ${item.words}${elsewhere}`;
}

/** Which control the card offers, by the root's policy and the person. */
export type PhaseControl = "establish" | "supersede" | "propose" | "none";

/**
 * The policy reading: a permitted person establishes; a person the policy
 * does not permit sees no control and the policy named; a policy that is
 * not the owner's turns the control into a proposal for the person it names
 * to accept in place (`BO_0249_010`) — unreachable today, since `owner` is
 * the one policy declared, and answered here so the card needs no change
 * when another is.
 */
export function policyReading(permitted: boolean, policy: string): { readonly control: "establish" | "propose" | "none"; readonly note: string | null } {
  if (permitted) return { control: "establish", note: null };
  if (policy === "owner" || policy === "") return { control: "none", note: "Only the owner may establish this" };
  return { control: "propose", note: `${policy} establishes this; you may propose it` };
}

/** What the card says, decided once from the read. */
export interface CardReading {
  readonly question: string;
  readonly lead: string;
  readonly lines: readonly string[];
  readonly conflict: { readonly documentId: string; readonly title: string } | null;
  readonly control: PhaseControl;
  readonly label: string;
  readonly note: string | null;
}

export const PHASE_QUESTION = "Establish this as the accepted direction?";
export const NOTHING_RESTS = "Nothing else in the network rests on this yet";

/**
 * The card from the consequences read: the question, *This would:* and the
 * consequences in words — or that nothing rests on this yet — the accepted
 * root that contradicts this one, named, and the one control the policy
 * allows: *Establish*, *Establish and supersede «title»* when a conflict
 * stands, *Propose acceptance* under another's policy, none otherwise.
 * A proposed root's consequences stay hypothetical until the press (rule 11).
 */
export function cardReading(consequences: Consequences): CardReading {
  const lines = consequences.items.map((item) => consequenceWords(item, consequences.documentId));
  const conflict = consequences.conflicts[0] ?? null;
  const policy = policyReading(consequences.permitted, consequences.policy);
  const control: PhaseControl = policy.control === "establish" && conflict !== null ? "supersede" : policy.control;
  const label =
    control === "supersede" && conflict !== null
      ? `Establish and supersede ${conflict.title}`
      : control === "propose"
        ? "Propose acceptance"
        : "Establish";
  return {
    question: PHASE_QUESTION,
    lead: lines.length === 0 ? NOTHING_RESTS : "This would:",
    lines,
    conflict,
    control,
    label,
    note: policy.note,
  };
}

/** What a conflict reads as on the card, above the control. */
export const conflictWords = (title: string): string => `${title} is the accepted direction and contradicts this`;

/** A run's proposal of the transition, as the proposals read lists it. */
export interface PhaseItem {
  readonly itemId: string;
  readonly groupId: string;
  readonly kind: string;
  readonly phase?: string;
  readonly supersededBy?: string;
  /** The run's sentence of consequences, from the group's rationale. */
  readonly sentence?: string;
}

/**
 * The run's `phase` item standing against the document, when one does: it
 * is the transition card under the intent and never a proposal block
 * (`BO_0249_011`). A module function rather than a closure, so a `$` may
 * call it.
 */
export function phaseItemOf(
  proposals: { readonly groups: readonly { readonly items: readonly { readonly kind: string; readonly itemId: string; readonly groupId: string }[] }[] } | null | undefined,
): PhaseItem | null {
  if (proposals == null) return null;
  for (const group of proposals.groups) {
    for (const item of group.items) {
      if (item.kind === "phase") return item as PhaseItem;
    }
  }
  return null;
}
