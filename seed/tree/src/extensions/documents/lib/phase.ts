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
 * The root's phase, or null where there is nothing to say: a change document
 * has its status and never a phase, and a document nobody has decided
 * anything about carries none either. Absent no longer reads as proposed —
 * *Proposed* has left the reader's vocabulary, and the way into the decision
 * is *Establish…* in the bar (`BO_0274_007`).
 */
export function phaseOf(document: PhasedDocument): Phase | null {
  if (document.change !== undefined) return null;
  return isPhase(document.phase) && document.phase !== "proposed" ? document.phase : null;
}

/**
 * The line's words: *Accepted*, with each kind of claim that is not accepted
 * named and the empty clause dropped, or *Superseded by «title»*. A root with
 * nothing decided about it has no line, so there are no words for it
 * (`BO_0274_007`).
 */
export function phaseWords(
  phase: Phase,
  successorTitle: string | null = null,
  standing: AcceptanceStanding | null = null,
): string {
  switch (phase) {
    case "proposed":
      return "";
    case "accepted": {
      const clauses = [
        ...(standing !== null && standing.changed > 0 ? [`${standing.changed} changed`] : []),
        ...(standing !== null && standing.edited > 0
          ? [`${standing.edited} ${standing.edited === 1 ? "block" : "blocks"} edited since`]
          : []),
        ...(standing !== null && standing.notAccepted > 0 ? [`${standing.notAccepted} not accepted`] : []),
      ];
      return clauses.length === 0 ? "Accepted" : `Accepted · ${clauses.join(", ")}`;
    }
    case "superseded":
      return successorTitle === null || successorTitle === "" ? "Superseded" : `Superseded by ${successorTitle}`;
  }
}

/** What has moved since the root was accepted, per block (`BO_0274_006`,
 * revised by the walk): an edit the refinement judged material, or a block
 * whose claim contradicts a claim accepted elsewhere. A rewording is not
 * reported: any block says something, and what matters is whether what it
 * says moved. User decision, 2026-09-21. */
export type BlockStanding = "changed" | "edited" | "notAccepted";

export interface AcceptanceItem {
  readonly blockId: string;
  readonly words: string;
  readonly standing: BlockStanding;
  readonly judgement?: { readonly outcome: string; readonly explanation: string };
  readonly collidesWith?: {
    readonly words: string;
    readonly documentId: string;
    readonly documentTitle: string;
    readonly relationId: string;
  };
}

/**
 * The edits that moved what a document says, from the judgements it already
 * carries (`BO_0274_015`): the newest `change` judgement per block recorded
 * after the stamp, kept only when the refinement judged the edit material —
 * `changed`, `narrowed` or `broadened`. A rewording or a clarification is not
 * a change to what the document says and is not reported. Pure, so the line,
 * the card and the run's context cannot disagree about what moved.
 */
export const MATERIAL_OUTCOMES: readonly string[] = ["changed", "narrowed", "broadened"];

export interface JudgedEdit {
  readonly about: string;
  readonly outcome: string;
  readonly subject: string;
  readonly dataRevision: number;
  readonly explanation: readonly { readonly text: string }[];
}

export interface JudgedBlock {
  readonly outcome: string;
  readonly explanation: string;
  readonly dataRevision: number;
}

/** The newest `change` judgement per block since the stamp, whatever it
 * found: what a refinement has already said about the edits made since the
 * decision. */
export function judgedSince(judgements: readonly JudgedEdit[], acceptedAt: number): ReadonlyMap<string, JudgedBlock> {
  const judged = new Map<string, JudgedBlock>();
  // The judgements arrive newest first, so the first one seen for a block is
  // the one that stands.
  for (const judgement of judgements) {
    if (judgement.about !== "change" || judgement.dataRevision <= acceptedAt) continue;
    const blockId = judgement.subject.startsWith("node:") ? judgement.subject.slice(5) : judgement.subject;
    if (judged.has(blockId)) continue;
    judged.set(blockId, {
      outcome: judgement.outcome,
      explanation: judgement.explanation.map((run) => run.text).join("").trim(),
      dataRevision: judgement.dataRevision,
    });
  }
  return judged;
}

/**
 * What a block stands as under the acceptance, from its own revision and
 * what a refinement has said about it (`BO_0274_017`):
 *
 * - nothing, when it has not been touched since the stamp;
 * - `changed`, when a refinement judged the edit material and that judgement
 *   is as new as the block — the refinement's own sentence says what moved;
 * - nothing, when it judged the edit a rewording or a clarification: that is
 *   not a change to what the document says;
 * - `edited`, when the block has moved and nothing has judged the words it
 *   holds now. The hint is free — the document read already carries each
 *   block's revision — and *Has this moved since it was accepted?* is what
 *   turns it into an answer.
 */
export function standingFor(
  revisedAt: number | undefined,
  acceptedAt: number,
  judged: JudgedBlock | undefined,
): "changed" | "edited" | null {
  const moved = typeof revisedAt === "number" && revisedAt > acceptedAt;
  // A judgement older than the block's own revision has been overtaken: the
  // words it judged are not the words standing now.
  const covers = judged !== undefined && (!moved || judged.dataRevision >= (revisedAt ?? 0));
  if (covers) return MATERIAL_OUTCOMES.includes(judged.outcome) ? "changed" : null;
  return moved ? "edited" : null;
}

/** The acceptance read (`GET documents/[id]/acceptance`, `BO_0274_006`). */
export interface Acceptance {
  readonly documentId: string;
  readonly phase: Phase;
  readonly acceptedAt?: number;
  readonly items: readonly AcceptanceItem[];
}

/** What the line counts: how much has moved, each way. */
export interface AcceptanceStanding {
  readonly changed: number;
  readonly edited: number;
  readonly notAccepted: number;
}

export function standingOf(acceptance: Acceptance | null): AcceptanceStanding | null {
  if (acceptance === null || acceptance.items.length === 0) return null;
  return {
    changed: acceptance.items.filter((item) => item.standing === "changed").length,
    edited: acceptance.items.filter((item) => item.standing === "edited").length,
    notAccepted: acceptance.items.filter((item) => item.standing === "notAccepted").length,
  };
}

/** Whether a run reading this root's lead may rely on it: `accepted` only
 * where nothing has moved since the stamp (`BO_0274_011`). */
export function leadWords(phase: Phase | null, standing: AcceptanceStanding | null): string {
  if (phase === "superseded") return "superseded";
  if (phase !== "accepted") return "";
  return standing !== null && (standing.changed > 0 || standing.notAccepted > 0) ? "accepted · changed" : "accepted";
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
  /** What the press could not take, and what has moved since it was made:
   * empty for a root with nothing to report. BO_0274_008 */
  readonly report: readonly string[];
  readonly conflict: { readonly documentId: string; readonly title: string } | null;
  readonly control: PhaseControl;
  readonly label: string;
  readonly note: string | null;
}

export const PHASE_QUESTION = "Establish this as the accepted direction?";
/** The same act on a root that already stands accepted: the person asked to
 * commit and the root has drifted, so the re-stamp is the commit.
 * BO_0274_008 */
export const RE_PHASE_QUESTION = "Re-establish as the accepted direction?";
export const NOTHING_RESTS = "Nothing else in the network rests on this yet";

/**
 * The card from the consequences read: the question, *This would:* and the
 * consequences in words — or that nothing rests on this yet — the accepted
 * root that contradicts this one, named, and the one control the policy
 * allows: *Establish*, *Establish and supersede «title»* when a conflict
 * stands, *Propose acceptance* under another's policy, none otherwise.
 * A proposed root's consequences stay hypothetical until the press (rule 11).
 */
export function cardReading(consequences: Consequences, acceptance: Acceptance | null = null): CardReading {
  const lines = consequences.items.map((item) => consequenceWords(item, consequences.documentId));
  const conflict = consequences.conflicts[0] ?? null;
  const policy = policyReading(consequences.permitted, consequences.policy);
  const control: PhaseControl = policy.control === "establish" && conflict !== null ? "supersede" : policy.control;
  const accepted = consequences.phase === "accepted";
  const establishing = accepted ? "Re-establish" : "Establish";
  const label =
    control === "supersede" && conflict !== null
      ? `${establishing} and supersede ${conflict.title}`
      : control === "propose"
        ? "Propose acceptance"
        : establishing;
  return {
    question: accepted ? RE_PHASE_QUESTION : PHASE_QUESTION,
    lead: lines.length === 0 ? NOTHING_RESTS : "This would:",
    lines,
    report: reportLines(acceptance),
    conflict,
    control,
    label,
    note: policy.note,
  };
}

/**
 * What the press could not take, and what has moved since it was made
 * (`BO_0274_008`): a claim that was added after the stamp, one contradicting a
 * claim accepted elsewhere — named with the claim it collides with and that
 * claim's document — and one whose words have changed since the decision. A
 * press accepts what it can; this is the rest, reported rather than refused.
 */
export function reportLines(acceptance: Acceptance | null): readonly string[] {
  if (acceptance === null) return [];
  return acceptance.items.map((item) => {
    if (item.standing === "edited") {
      return `${clip(item.words)} has been edited since the decision, and nothing has judged it yet`;
    }
    if (item.standing === "changed") {
      const clipped = clip(item.words);
      return item.judgement === undefined
        ? `${clipped} has changed since the decision`
        : `${clipped} — ${item.judgement.outcome}: ${item.judgement.explanation}`;
    }
    const collision = item.collidesWith;
    return collision === undefined
      ? `${clip(item.words)} is not accepted`
      : `${clip(item.words)} is not accepted: it contradicts ${collision.words} in ${collision.documentTitle}`;
  });
}

/** A block's opening words, cut where the report needs a name rather than
 * the block. */
const clip = (words: string, at = 60): string => (words.length <= at ? words : `${words.slice(0, at).trimEnd()}…`);

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
