import { query } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import { readSession } from "~/server/session";
import { type DocumentView } from "./assemble";
import { bareId, contentOf, nodeRef } from "~/server/ccgw/nodes";
import type { DocumentJudgements } from "./judgements";
import { judgedSince, standingFor } from "../lib/phase";
import { ACCEPTED_AT_PROPERTY, DOCUMENT_TYPE, PHASE_PROPERTY, SUPERSEDED_BY_PROPERTY, isPhase, type Phase } from "./vocabulary";
import { relationsOf, type DocumentRelations, type RelationView } from "./work";

/**
 * What accepting a root would do, read from the network (`BO_0249_007`,
 * material §20): the relations sourced on the root's claims and the ones
 * that rest on them from elsewhere, the roots it supersedes, and the
 * unresolved judgements standing on its blocks. A proposed root's
 * consequences are hypothetical until the transition (rule 11); the card
 * says so in its heading, this read only lists them.
 */
export interface ConsequenceItem {
  readonly kind: "constrains" | "supports" | "contradicts" | "supersedes" | "judgement";
  /** The far block's opening words, or the judgement's outcome and effect. */
  readonly words: string;
  readonly documentId?: string;
  readonly documentTitle?: string;
  readonly blockId?: string;
  readonly relationId?: string;
}

export interface Consequences {
  readonly documentId: string;
  readonly phase: Phase;
  readonly supersededBy?: string;
  /** Whether the signed-in person may establish under the root's policy. */
  readonly permitted: boolean;
  /** The policy the root is under: `owner`, the one rule today (`BO_0249_006`). */
  readonly policy: "owner";
  /** Accepted roots contradicting this one, which acceptance must supersede. */
  readonly conflicts: readonly { readonly documentId: string; readonly title: string }[];
  readonly items: readonly ConsequenceItem[];
}

/** The kinds that make the far root rest on this one when this one is their target. */
const CONSTRAINING = ["dependsOn", "implements", "affectedBy"] as const;
const SUPPORTING = ["supports", "evidences"] as const;

const opening = (relation: RelationView, far: "source" | "target"): string =>
  relation[far].text.map((run) => run.text).join("").trim();

/** Which end of a relation is a block of this document, if either. */
const hereEnd = (relation: RelationView, documentId: string): "source" | "target" | null =>
  relation.source.documentId === documentId ? "source" : relation.target.documentId === documentId ? "target" : null;

/** The established relations of the root that reach another document, by the end that is here. */
const reaching = (relations: DocumentRelations, documentId: string) =>
  relations.relations
    .filter((relation) => relation.status === "established" && relation.state !== "retired" && relation.state !== "orphaned")
    .map((relation) => ({ relation, here: hereEnd(relation, documentId) }))
    .filter((entry): entry is { relation: RelationView; here: "source" | "target" } => entry.here !== null)
    .filter(({ relation, here }) => relation[here === "source" ? "target" : "source"].documentId !== documentId);

/** The phases of other documents, with the stamp each acceptance made, read
 * in one rooted query. */
async function phasesOf(documentIds: readonly string[]): Promise<GraphOutcome<ReadonlyMap<string, { phase: Phase; title: string; acceptedAt: number | null }>>> {
  const ids = [...new Set(documentIds.filter((id) => id !== ""))];
  const phases = new Map<string, { phase: Phase; title: string; acceptedAt: number | null }>();
  if (ids.length === 0) return { outcome: "success", result: phases };
  const read = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d ROOT d`,
    roots: ids.map(nodeRef),
    purpose: "phases of related roots",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: phases };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  for (const node of read.result.nodes) {
    if (node.revision.status !== "established") continue;
    const content = contentOf(node);
    const phase = content[PHASE_PROPERTY];
    const title = content["title"];
    const acceptedAt = content[ACCEPTED_AT_PROPERTY];
    phases.set(bareId(node.id), {
      phase: isPhase(phase) ? phase : "proposed",
      title: typeof title === "string" ? title : "",
      acceptedAt: typeof acceptedAt === "number" ? acceptedAt : null,
    });
  }
  return { outcome: "success", result: phases };
}

/**
 * The accepted roots contradicting this one on a declared `contradicts`
 * relation, whichever end is here: what `setDocumentPhase` refuses `accepted`
 * over unless one is superseded in the same mutation.
 */
export async function conflictsOf(
  document: DocumentView,
): Promise<GraphOutcome<readonly { readonly documentId: string; readonly title: string }[]>> {
  const relations = await relationsOf(document);
  if (relations.outcome !== "success") return relations as GraphOutcome<never>;
  const contradicting = reaching(relations.result, document.documentId).filter(({ relation }) => relation.kind === "contradicts");
  const far = contradicting.map(({ relation, here }) => relation[here === "source" ? "target" : "source"].documentId);
  const phases = await phasesOf(far);
  if (phases.outcome !== "success") return phases as GraphOutcome<never>;
  const seen = new Set<string>();
  const conflicts: { documentId: string; title: string }[] = [];
  for (const id of far) {
    const known = phases.result.get(id);
    if (known === undefined || known.phase !== "accepted" || seen.has(id)) continue;
    seen.add(id);
    conflicts.push({ documentId: id, title: known.title });
  }
  return { outcome: "success", result: conflicts };
}

/** The consequences of accepting the document, for the transition card. */
export async function consequencesFor(document: DocumentView, judgements: DocumentJudgements): Promise<GraphOutcome<Consequences>> {
  const relations = await relationsOf(document);
  if (relations.outcome !== "success") return relations as GraphOutcome<never>;
  const entries = reaching(relations.result, document.documentId);
  const items: ConsequenceItem[] = [];
  for (const { relation, here } of entries) {
    const far = here === "source" ? "target" : "source";
    const kind: ConsequenceItem["kind"] | null =
      here === "target" && (CONSTRAINING as readonly string[]).includes(relation.kind)
        ? "constrains"
        : here === "source" && (SUPPORTING as readonly string[]).includes(relation.kind)
          ? "supports"
          : here === "source" && relation.kind === "contradicts"
            ? "contradicts"
            : here === "source" && relation.kind === "supersedes"
              ? "supersedes"
              : null;
    if (kind === null) continue;
    // A far claim no block asserts — one left orphaned when its block's
    // anchor was never re-anchored (ccgw.md, the carry-forward stamp) — places
    // nowhere and rests on nothing, so accepting affects nothing there.
    if (relation[far].blockId === "" || relation[far].documentId === "") continue;
    items.push({
      kind,
      words: opening(relation, far),
      documentId: relation[far].documentId,
      documentTitle: relation[far].documentTitle,
      blockId: relation[far].blockId,
      relationId: relation.relationId,
    });
  }
  for (const [blockId, standing] of Object.entries(judgements.pressure)) {
    for (const pressure of standing) {
      const effect = pressure.explanation.map((run) => run.text).join("").trim();
      items.push({
        kind: "judgement",
        words: `${pressure.outcome}: ${effect}`,
        blockId,
        relationId: pressure.relationId,
      });
    }
  }
  const conflicts = await conflictsOf(document);
  if (conflicts.outcome !== "success") return conflicts as GraphOutcome<never>;
  // The policy is the owner's rule today: any human account the instance
  // admits may establish; a class-agent account may only propose. BO_0249_010
  const person = await readSession();
  const permitted = person !== null && person.class === "human";
  return {
    outcome: "success",
    result: {
      documentId: document.documentId,
      phase: document.phase ?? "proposed",
      ...(document.supersededBy !== undefined ? { supersededBy: document.supersededBy } : {}),
      permitted,
      policy: "owner",
      conflicts: conflicts.result,
      items,
    },
  };
}

/**
 * What has moved since a root was accepted, derived and stored nowhere
 * (`BO_0274_006`, revised by the walk on 2026-09-21). The press stores one
 * fact — `acceptedAt`, the revision it was made at — and the report is read
 * from what the graph already holds about the blocks:
 *
 * - `changed`: `calliopa-refine` judged an edit to the block material since
 *   the stamp — `changed`, `narrowed` or `broadened` — and that judgement is
 *   as new as the block. A rewording or a clarification is not a change to
 *   what the document says, so it takes the block off the list.
 * - `edited`: the block has moved since the stamp and nothing has judged the
 *   words it holds now. Free to read — the document carries each block's
 *   revision — so a page that moved never passes for one that did not, and
 *   *Has this moved since it was accepted?* is what turns the hint into an
 *   answer. Nothing refines unasked (`BO_0258`). User decisions, 2026-09-21.
 *
 * Every block is covered, whether or not it asserts a claim: any block says
 * something, and what matters is whether what it says moved.
 * - `notAccepted`: a claim the block asserts contradicts a claim accepted in
 *   another root — the exception a press reports rather than refusing over.
 *   It is derived, so a collision resolved later clears itself.
 *
 * The derivation does not recurse: a far claim counts as accepted when its
 * root is accepted and it has not been revised since that root's stamp, and
 * its own collisions are not walked. Two accepted roots whose claims
 * contradict therefore read as not accepted on both sides, which is the
 * honest answer while they stand in conflict.
 */
export type BlockStanding = "changed" | "edited" | "notAccepted";

export interface AcceptanceItem {
  readonly blockId: string;
  /** The block's opening words, for the line's report. */
  readonly words: string;
  readonly standing: BlockStanding;
  /** What the refinement took the edit to be, and its own sentence. */
  readonly judgement?: { readonly outcome: string; readonly explanation: string };
  /** The accepted claim this block's claim contradicts. */
  readonly collidesWith?: {
    readonly words: string;
    readonly documentId: string;
    readonly documentTitle: string;
    readonly relationId: string;
  };
}

export interface Acceptance {
  readonly documentId: string;
  readonly phase: Phase;
  /** Absent for a root that was never accepted; the items are then empty. */
  readonly acceptedAt?: number;
  readonly items: readonly AcceptanceItem[];
}

const openingOf = (block: DocumentView["blocks"][number]): string =>
  block.kind === "text" ? block.runs.map((run) => run.text).join("").trim() : "";

/** The revisions of claims in other documents, for the far end of a
 * contradiction: a metadata read, only when there are contradictions. */
async function revisionsOf(claimRefs: readonly string[]): Promise<GraphOutcome<ReadonlyMap<string, number>>> {
  const at = new Map<string, number>();
  const refs = [...new Set(claimRefs)].sort();
  if (refs.length === 0) return { outcome: "success", result: at };
  const read = await query({
    statement: "MATCH (c) RETURN GRAPH c ROOT c",
    roots: refs,
    purpose: "far claims at their stamp",
  });
  if (read.outcome === "noResult") return { outcome: "success", result: at };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  for (const node of read.result.nodes) {
    if (typeof node.revision.dataRevision === "number") at.set(node.id, node.revision.dataRevision);
  }
  return { outcome: "success", result: at };
}

export async function acceptanceOf(
  document: DocumentView,
  relations: DocumentRelations,
  judgements: DocumentJudgements,
): Promise<GraphOutcome<Acceptance>> {
  const phase = document.phase ?? "proposed";
  const acceptedAt = document.acceptedAt;
  if (phase !== "accepted" || typeof acceptedAt !== "number") {
    return { outcome: "success", result: { documentId: document.documentId, phase, items: [] } };
  }

  // What moved: the newest material classification recorded on a block since
  // the stamp. A block judged twice counts once, by its newest judgement.
  const judged = judgedSince(judgements.judgements, acceptedAt);

  // The collisions: an established `contradicts` with one end here, whose far
  // claim is accepted in its own root.
  const contradicting = reaching(relations, document.documentId).filter(({ relation }) => relation.kind === "contradicts");
  const farPhases = await phasesOf(contradicting.map(({ relation, here }) => relation[here === "source" ? "target" : "source"].documentId));
  if (farPhases.outcome !== "success") return farPhases as GraphOutcome<never>;
  const farRevisions = await revisionsOf(
    contradicting.map(({ relation, here }) => nodeRef(relation[here === "source" ? "target" : "source"].claimId)),
  );
  if (farRevisions.outcome !== "success") return farRevisions as GraphOutcome<never>;
  const collisions = new Map<string, AcceptanceItem["collidesWith"]>();
  for (const { relation, here } of contradicting) {
    const far = relation[here === "source" ? "target" : "source"];
    const near = relation[here];
    const root = farPhases.result.get(far.documentId);
    if (root === undefined || root.phase !== "accepted" || root.acceptedAt === null) continue;
    const revised = farRevisions.result.get(nodeRef(far.claimId));
    if (revised !== undefined && revised > root.acceptedAt) continue;
    if (near.blockId === "" || collisions.has(near.blockId)) continue;
    collisions.set(near.blockId, {
      words: far.text.map((run) => run.text).join("").trim(),
      documentId: far.documentId,
      documentTitle: far.documentTitle,
      relationId: relation.relationId,
    });
  }

  // The document's own order, so the report reads as the page reads.
  const items: AcceptanceItem[] = [];
  for (const block of document.blocks) {
    const collidesWith = collisions.get(block.blockId);
    if (collidesWith !== undefined) {
      items.push({ blockId: block.blockId, words: openingOf(block), standing: "notAccepted", collidesWith });
      continue;
    }
    const judgement = judged.get(block.blockId);
    const standing = standingFor(block.revisedAt, acceptedAt, judgement);
    if (standing === "changed" && judgement !== undefined) {
      items.push({
        blockId: block.blockId,
        words: openingOf(block),
        standing,
        judgement: { outcome: judgement.outcome, explanation: judgement.explanation },
      });
    } else if (standing === "edited") {
      items.push({ blockId: block.blockId, words: openingOf(block), standing });
    }
  }

  return { outcome: "success", result: { documentId: document.documentId, phase, acceptedAt, items } };
}

export { SUPERSEDED_BY_PROPERTY };
