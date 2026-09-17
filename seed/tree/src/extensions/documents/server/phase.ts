import { query } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import { readSession } from "~/server/session";
import { type DocumentView } from "./assemble";
import { bareId, contentOf, nodeRef } from "~/server/ccgw/nodes";
import type { DocumentJudgements } from "./judgements";
import { DOCUMENT_TYPE, PHASE_PROPERTY, SUPERSEDED_BY_PROPERTY, isPhase, type Phase } from "./vocabulary";
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

/** The phases of other documents, read in one rooted query. */
async function phasesOf(documentIds: readonly string[]): Promise<GraphOutcome<ReadonlyMap<string, { phase: Phase; title: string }>>> {
  const ids = [...new Set(documentIds.filter((id) => id !== ""))];
  const phases = new Map<string, { phase: Phase; title: string }>();
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
    phases.set(bareId(node.id), { phase: isPhase(phase) ? phase : "proposed", title: typeof title === "string" ? title : "" });
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

export { SUPERSEDED_BY_PROPERTY };
